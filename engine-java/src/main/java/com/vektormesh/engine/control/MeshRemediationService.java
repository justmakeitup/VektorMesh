package com.vektormesh.engine.control;

import ai.vektormesh.v1.AnomalyVerdict;
import ai.vektormesh.v1.RecommendedAction;
import ai.vektormesh.v1.RouteWeightUpdate;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vektormesh.engine.chaos.ChaosFaultInjectorService;
import com.vektormesh.engine.domain.ServiceEdgeEntity;
import com.vektormesh.engine.repository.AuditLedgerRepository;
import com.vektormesh.engine.repository.ServiceEdgeRepository;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Active Mesh Remediation & Autonomous Self-Healing Controller.
 * Manages Resilience4j circuit breakers, dynamic traffic weight adjustments,
 * container restart simulations, and zero-tamper cryptographic audit logging.
 */
@Service
public class MeshRemediationService {

    private static final Logger log = LoggerFactory.getLogger(MeshRemediationService.class);
    private static final long COOLDOWN_WINDOW_MS = 10_000L; // 10 seconds cooldown

    private final CircuitBreakerRegistry circuitBreakerRegistry;
    private final ServiceEdgeRepository serviceEdgeRepository;
    private final AuditLedgerRepository auditLedgerRepository;
    private final ChaosFaultInjectorService chaosFaultInjectorService;
    private final ObjectMapper objectMapper;

    // Cooldown and idempotency guard
    private final ConcurrentHashMap<String, Long> lastRemediationTimeMs = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Float> lastRemediationProbability = new ConcurrentHashMap<>();

    public MeshRemediationService(
            CircuitBreakerRegistry circuitBreakerRegistry,
            ServiceEdgeRepository serviceEdgeRepository,
            AuditLedgerRepository auditLedgerRepository,
            ChaosFaultInjectorService chaosFaultInjectorService,
            ObjectMapper objectMapper
    ) {
        this.circuitBreakerRegistry = circuitBreakerRegistry;
        this.serviceEdgeRepository = serviceEdgeRepository;
        this.auditLedgerRepository = auditLedgerRepository;
        this.chaosFaultInjectorService = chaosFaultInjectorService;
        this.objectMapper = objectMapper;
    }

    /**
     * Executes autonomous remediation based on ML AnomalyVerdict.
     */
    @Transactional
    public boolean executeAutonomousRemediation(AnomalyVerdict verdict) {
        String serviceId = verdict.getServiceId();
        RecommendedAction action = verdict.getRecommendedAction();
        float currentProb = verdict.getCascadeProbability();

        if (action == RecommendedAction.NO_OP) {
            return false;
        }

        // Idempotency & Cooldown Guard
        long now = System.currentTimeMillis();
        Long lastTime = lastRemediationTimeMs.get(serviceId);
        Float lastProb = lastRemediationProbability.get(serviceId);

        if (lastTime != null && (now - lastTime < COOLDOWN_WINDOW_MS)) {
            // Check severity escalation: only proceed if probability jumped by > 0.15
            if (lastProb != null && (currentProb - lastProb <= 0.15f)) {
                log.debug("Autonomous remediation suppressed by cooldown guard for service={} (currentProb={}, lastProb={})",
                        serviceId, currentProb, lastProb);
                return false;
            }
            log.warn("Cooldown bypassed due to severity escalation for service={}: lastProb={}, currentProb={}",
                    serviceId, lastProb, currentProb);
        }

        log.info("EXECUTING AUTONOMOUS REMEDIATION: service={}, action={}, prob={}",
                serviceId, action, currentProb);

        boolean executed = switch (action) {
            case THROTTLE_TRAFFIC -> applyTrafficThrottling(serviceId, verdict, 50.0, 50.0);
            case REROUTE_COLD_REPLICA -> applyTrafficThrottling(serviceId, verdict, 20.0, 80.0);
            case OPEN_CIRCUIT -> applyCircuitBreakerTrip(serviceId, verdict);
            case RESTART_CONTAINER -> applyContainerSelfHealing(serviceId, verdict);
            default -> false;
        };

        if (executed) {
            lastRemediationTimeMs.put(serviceId, now);
            lastRemediationProbability.put(serviceId, currentProb);
        }

        return executed;
    }

    /**
     * Shifts traffic weight toward cold replica and throttles primary path.
     */
    @Transactional
    public boolean applyTrafficThrottling(String serviceId, AnomalyVerdict verdict, double primaryPct, double coldPct) {
        List<ServiceEdgeEntity> incomingEdges = serviceEdgeRepository.findByTargetServiceId(serviceId);
        if (incomingEdges.isEmpty()) {
            return false;
        }

        Map<String, Object> auditPayload = new HashMap<>();
        auditPayload.put("remediation", verdict.getRecommendedAction().name());
        auditPayload.put("root_cause", verdict.getRootCauseMetric().name());
        auditPayload.put("ewma_z_score", verdict.getEwmaZScore());
        auditPayload.put("isolation_forest_score", verdict.getIsolationForestScore());
        auditPayload.put("previous_weights", incomingEdges.stream().map(e -> Map.of(
                "edgeId", e.getId(),
                "primary", e.getPrimaryWeightPct(),
                "cold", e.getColdReplicaWeightPct()
        )).toList());

        for (ServiceEdgeEntity edge : incomingEdges) {
            edge.setPrimaryWeightPct(BigDecimal.valueOf(primaryPct));
            edge.setCanaryWeightPct(BigDecimal.ZERO);
            edge.setColdReplicaWeightPct(BigDecimal.valueOf(coldPct));
            serviceEdgeRepository.save(edge);
        }

        auditPayload.put("updated_weights", Map.of("primary", primaryPct, "canary", 0.0, "cold", coldPct));

        writeAuditLog(serviceId, verdict.getRecommendedAction().name(), "AUTONOMOUS_AI",
                BigDecimal.valueOf(verdict.getCascadeProbability()), auditPayload);

        return true;
    }

    /**
     * Trips Resilience4j Circuit Breaker to OPEN state and updates edge states.
     */
    @Transactional
    public boolean applyCircuitBreakerTrip(String serviceId, AnomalyVerdict verdict) {
        CircuitBreaker cb = circuitBreakerRegistry.circuitBreaker(serviceId);
        cb.transitionToOpenState();

        List<ServiceEdgeEntity> incomingEdges = serviceEdgeRepository.findByTargetServiceId(serviceId);
        for (ServiceEdgeEntity edge : incomingEdges) {
            edge.setCircuitState("OPEN");
            serviceEdgeRepository.save(edge);
        }

        Map<String, Object> auditPayload = new HashMap<>();
        auditPayload.put("remediation", "OPEN_CIRCUIT");
        auditPayload.put("circuit_breaker_state", "OPEN");
        auditPayload.put("root_cause", verdict.getRootCauseMetric().name());
        auditPayload.put("cascade_probability", verdict.getCascadeProbability());

        writeAuditLog(serviceId, "OPEN_CIRCUIT", "AUTONOMOUS_AI",
                BigDecimal.valueOf(verdict.getCascadeProbability()), auditPayload);

        log.warn("Circuit Breaker OPEN for service={}: blast radius isolated.", serviceId);
        return true;
    }

    /**
     * Simulates container restart: clears faults, resets memory bleed, and restores healthy state.
     */
    @Transactional
    public boolean applyContainerSelfHealing(String serviceId, AnomalyVerdict verdict) {
        log.warn("CONTAINER SELF-HEALING RECYCLE TRIGGERED: service={}", serviceId);

        // 1. Clear active chaos faults and memory bleed
        chaosFaultInjectorService.clearFault(serviceId);

        // 2. Reset circuit breaker cleanly to CLOSED
        CircuitBreaker cb = circuitBreakerRegistry.circuitBreaker(serviceId);
        cb.reset();

        // 3. Restore healthy routing weights in DB
        List<ServiceEdgeEntity> incomingEdges = serviceEdgeRepository.findByTargetServiceId(serviceId);
        for (ServiceEdgeEntity edge : incomingEdges) {
            edge.setPrimaryWeightPct(BigDecimal.valueOf(100.00));
            edge.setCanaryWeightPct(BigDecimal.ZERO);
            edge.setColdReplicaWeightPct(BigDecimal.ZERO);
            edge.setCircuitState("CLOSED");
            serviceEdgeRepository.save(edge);
        }

        Map<String, Object> auditPayload = new HashMap<>();
        auditPayload.put("remediation", "RESTART_CONTAINER");
        auditPayload.put("root_cause", verdict != null ? verdict.getRootCauseMetric().name() : "MANUAL_RESTART");
        auditPayload.put("action_taken", "Container heap recycled, circuit breaker restored to CLOSED, routes set to 100% primary");

        float prob = verdict != null ? verdict.getCascadeProbability() : 0.0f;
        writeAuditLog(serviceId, "RESTART_CONTAINER", verdict != null ? "AUTONOMOUS_AI" : "MANUAL_OVERRIDE",
                BigDecimal.valueOf(prob), auditPayload);

        return true;
    }

    /**
     * Manual Override of Route Weights.
     */
    @Transactional
    public boolean applyManualRouteOverride(RouteWeightUpdate update) {
        var edgeOpt = serviceEdgeRepository.findBySourceServiceIdAndTargetServiceId(
                update.getSourceServiceId(), update.getTargetServiceId()
        );

        if (edgeOpt.isEmpty()) {
            return false;
        }

        ServiceEdgeEntity edge = edgeOpt.get();
        edge.setPrimaryWeightPct(BigDecimal.valueOf(update.getPrimaryWeightPct()));
        edge.setCanaryWeightPct(BigDecimal.valueOf(update.getCanaryWeightPct()));
        edge.setColdReplicaWeightPct(BigDecimal.valueOf(update.getColdReplicaWeightPct()));
        serviceEdgeRepository.save(edge);

        Map<String, Object> payload = Map.of(
                "source", update.getSourceServiceId(),
                "target", update.getTargetServiceId(),
                "primary", update.getPrimaryWeightPct(),
                "canary", update.getCanaryWeightPct(),
                "cold", update.getColdReplicaWeightPct(),
                "reason", update.getReason()
        );

        writeAuditLog(update.getTargetServiceId(), "MANUAL_ROUTE_OVERRIDE", "MANUAL_OVERRIDE",
                BigDecimal.ZERO, payload);

        return true;
    }

    public CircuitBreaker.State getCircuitBreakerState(String serviceId) {
        return circuitBreakerRegistry.circuitBreaker(serviceId).getState();
    }

    private void writeAuditLog(String serviceId, String actionType, String triggerSource, BigDecimal probability, Map<String, Object> payloadMap) {
        try {
            String json = objectMapper.writeValueAsString(payloadMap);
            auditLedgerRepository.recordRemediationEvent(serviceId, actionType, triggerSource, probability, json);
        } catch (Exception e) {
            log.error("Failed to write audit ledger record for service={}", serviceId, e);
        }
    }
}
