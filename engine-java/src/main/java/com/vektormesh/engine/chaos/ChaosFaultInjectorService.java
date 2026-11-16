package com.vektormesh.engine.chaos;

import ai.vektormesh.v1.FaultType;
import com.vektormesh.engine.domain.ServiceEdgeEntity;
import com.vektormesh.engine.repository.AuditLedgerRepository;
import com.vektormesh.engine.repository.ServiceEdgeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;

/**
 * Interactive Chaos Fault Injection Engine.
 * Simulates real-time degradations (Latency spikes, Socket exhaustion, Memory bleed, Corrupt payloads)
 * and propagates blast-radius failures downstream/upstream through the topology graph.
 */
@Service
public class ChaosFaultInjectorService {

    private static final Logger log = LoggerFactory.getLogger(ChaosFaultInjectorService.class);

    private final ConcurrentHashMap<String, ActiveFaultState> activeFaults = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Double> accumulatedMemoryBleedMb = new ConcurrentHashMap<>();

    private final ServiceEdgeRepository serviceEdgeRepository;
    private final AuditLedgerRepository auditLedgerRepository;
    private final ExecutorService virtualThreadExecutor;

    public ChaosFaultInjectorService(
            ServiceEdgeRepository serviceEdgeRepository,
            AuditLedgerRepository auditLedgerRepository,
            ExecutorService virtualThreadExecutor
    ) {
        this.serviceEdgeRepository = serviceEdgeRepository;
        this.auditLedgerRepository = auditLedgerRepository;
        this.virtualThreadExecutor = virtualThreadExecutor;
    }

    /**
     * Injects a synthetic chaos fault on a target service.
     */
    public ActiveFaultState injectFault(String targetServiceId, FaultType faultType, int intensityPct, int durationSeconds) {
        long now = System.currentTimeMillis();
        long expiresAt = now + (durationSeconds * 1000L);

        ActiveFaultState fault = ActiveFaultState.builder()
                .targetServiceId(targetServiceId)
                .faultType(faultType)
                .intensityPct(intensityPct)
                .durationSeconds(durationSeconds)
                .startedAtMs(now)
                .expiresAtMs(expiresAt)
                .build();

        activeFaults.put(targetServiceId, fault);

        if (faultType == FaultType.MEMORY_BLEED) {
            accumulatedMemoryBleedMb.put(targetServiceId, 0.0);
        }

        log.warn("CHAOS FAULT INJECTED: service={}, type={}, intensity={}% duration={}s",
                targetServiceId, faultType, intensityPct, durationSeconds);

        // Schedule async audit log insertion
        virtualThreadExecutor.submit(() -> {
            String payload = String.format(
                    "{\"event\":\"CHAOS_FAULT_INJECTED\",\"fault_type\":\"%s\",\"intensity_pct\":%d,\"duration_seconds\":%d}",
                    faultType.name(), intensityPct, durationSeconds
            );
            auditLedgerRepository.recordRemediationEvent(
                    targetServiceId,
                    "CHAOS_INJECTION",
                    "CHAOS_INJECTOR",
                    BigDecimal.valueOf(intensityPct / 100.0),
                    payload
            );
        });

        return fault;
    }

    /**
     * Clears an active fault and resets memory bleed state.
     */
    public void clearFault(String serviceId) {
        ActiveFaultState removed = activeFaults.remove(serviceId);
        accumulatedMemoryBleedMb.remove(serviceId);
        if (removed != null) {
            log.info("CHAOS FAULT CLEARED: service={}, type={}", serviceId, removed.getFaultType());
        }
    }

    public Optional<ActiveFaultState> getActiveFault(String serviceId) {
        ActiveFaultState fault = activeFaults.get(serviceId);
        if (fault != null && fault.isExpired()) {
            activeFaults.remove(serviceId);
            accumulatedMemoryBleedMb.remove(serviceId);
            log.info("CHAOS FAULT EXPIRED: service={}, type={}", serviceId, fault.getFaultType());
            return Optional.empty();
        }
        return Optional.ofNullable(fault);
    }

    public Map<String, ActiveFaultState> getAllActiveFaults() {
        // Clean expired faults first
        activeFaults.entrySet().removeIf(entry -> entry.getValue().isExpired());
        return Collections.unmodifiableMap(activeFaults);
    }

    /**
     * Increments accumulated memory bleed for services experiencing MEMORY_BLEED.
     * Called once per second by the telemetry loop.
     */
    public void tickMemoryBleed() {
        for (Map.Entry<String, ActiveFaultState> entry : activeFaults.entrySet()) {
            if (entry.getValue().getFaultType() == FaultType.MEMORY_BLEED && !entry.getValue().isExpired()) {
                String serviceId = entry.getKey();
                int intensity = entry.getValue().getIntensityPct();
                // Bleed rate: e.g. 50% intensity = 10 MB/sec; 100% intensity = 20 MB/sec
                double deltaMb = (intensity / 100.0) * 18.0;
                accumulatedMemoryBleedMb.merge(serviceId, deltaMb, Double::sum);
            }
        }
    }

    public double getAccumulatedBleedMb(String serviceId) {
        return accumulatedMemoryBleedMb.getOrDefault(serviceId, 0.0);
    }

    /**
     * Calculates cascading blast-radius impacts propagated upstream to calling services.
     * If an edge's circuit breaker is OPEN, blast radius propagation drops to 0.0!
     */
    public CascadingImpact calculateCascadingImpact(String callingServiceId) {
        List<ServiceEdgeEntity> outgoingEdges = serviceEdgeRepository.findBySourceServiceId(callingServiceId);

        double addedLatencyMs = 0.0;
        double addedThreadPoolSaturationPct = 0.0;

        for (ServiceEdgeEntity edge : outgoingEdges) {
            String targetServiceId = edge.getTargetServiceId();
            Optional<ActiveFaultState> targetFaultOpt = getActiveFault(targetServiceId);

            if (targetFaultOpt.isEmpty()) {
                continue;
            }

            ActiveFaultState targetFault = targetFaultOpt.get();
            String circuitState = edge.getCircuitState();

            // Circuit Breaker Severance: If OPEN, the circuit trips and severs propagation completely!
            if ("OPEN".equalsIgnoreCase(circuitState)) {
                log.debug("Circuit breaker OPEN on edge {} -> {}: cascading blast radius SEVERED.",
                        callingServiceId, targetServiceId);
                continue;
            }

            // Traffic Weight Modulation: If cold replica handles traffic, primary weight is small
            double primaryWeight = edge.getPrimaryWeightPct().doubleValue() / 100.0;
            double propagationMultiplier = primaryWeight * ("HALF_OPEN".equalsIgnoreCase(circuitState) ? 0.20 : 0.60);

            switch (targetFault.getFaultType()) {
                case LATENCY_SPIKE -> {
                    double targetImpact = (targetFault.getIntensityPct() / 100.0) * 400.0;
                    addedLatencyMs += targetImpact * propagationMultiplier;
                    addedThreadPoolSaturationPct += (targetFault.getIntensityPct() / 100.0) * 20.0 * propagationMultiplier;
                }
                case SOCKET_EXHAUSTION -> {
                    double targetImpact = (targetFault.getIntensityPct() / 100.0) * 350.0;
                    addedLatencyMs += targetImpact * propagationMultiplier;
                    addedThreadPoolSaturationPct += (targetFault.getIntensityPct() / 100.0) * 45.0 * propagationMultiplier;
                }
                case CORRUPT_PAYLOAD -> {
                    addedLatencyMs += (targetFault.getIntensityPct() / 100.0) * 100.0 * propagationMultiplier;
                }
                case MEMORY_BLEED -> {
                    // Memory bleed does not immediately cascade latency until downstream crashes or GC pauses
                    double bleed = getAccumulatedBleedMb(targetServiceId);
                    if (bleed > 300.0) {
                        addedLatencyMs += (bleed / 20.0) * propagationMultiplier;
                    }
                }
                default -> {}
            }
        }

        return new CascadingImpact(addedLatencyMs, addedThreadPoolSaturationPct);
    }

    public record CascadingImpact(double additionalLatencyMs, double additionalThreadPoolSaturationPct) {}
}
