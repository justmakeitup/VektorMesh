package com.vektormesh.engine.telemetry;

import ai.vektormesh.v1.*;
import com.vektormesh.engine.chaos.ActiveFaultState;
import com.vektormesh.engine.chaos.ChaosFaultInjectorService;
import com.vektormesh.engine.control.MeshRemediationService;
import com.vektormesh.engine.domain.ServiceEdgeEntity;
import com.vektormesh.engine.domain.ServiceNodeEntity;
import com.vektormesh.engine.repository.ServiceEdgeRepository;
import com.vektormesh.engine.repository.ServiceNodeRepository;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Consumer;

/**
 * 1 Hz Telemetry Synthesis & Bidirectional gRPC Streaming Orchestrator.
 * Synthesizes cluster telemetry on Virtual Threads, connects to the Python Anomaly Engine,
 * dispatches autonomous remediations, and broadcasts live topology snapshots.
 */
@Service
public class TelemetryOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(TelemetryOrchestrator.class);

    private final ServiceNodeRepository serviceNodeRepository;
    private final ServiceEdgeRepository serviceEdgeRepository;
    private final ChaosFaultInjectorService chaosFaultInjectorService;
    private final MeshRemediationService meshRemediationService;
    private final ExecutorService virtualThreadExecutor;

    @GrpcClient("inference-engine")
    private AnomalyInferenceServiceGrpc.AnomalyInferenceServiceStub inferenceAsyncStub;

    @GrpcClient("inference-engine")
    private AnomalyInferenceServiceGrpc.AnomalyInferenceServiceBlockingStub inferenceBlockingStub;

    // Latest state caches
    private final ConcurrentHashMap<String, TelemetryFrame> latestFrames = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, AnomalyVerdict> latestVerdicts = new ConcurrentHashMap<>();

    // Streaming state
    private StreamObserver<TelemetryFrame> streamRequestObserver;
    private volatile boolean streamConnected = false;

    // Snapshot broadcast listeners (registered by gRPC MeshControlGrpcService)
    private final Set<Consumer<SystemStateSnapshot>> snapshotListeners = ConcurrentHashMap.newKeySet();

    public TelemetryOrchestrator(
            ServiceNodeRepository serviceNodeRepository,
            ServiceEdgeRepository serviceEdgeRepository,
            ChaosFaultInjectorService chaosFaultInjectorService,
            MeshRemediationService meshRemediationService,
            ExecutorService virtualThreadExecutor
    ) {
        this.serviceNodeRepository = serviceNodeRepository;
        this.serviceEdgeRepository = serviceEdgeRepository;
        this.chaosFaultInjectorService = chaosFaultInjectorService;
        this.meshRemediationService = meshRemediationService;
        this.virtualThreadExecutor = virtualThreadExecutor;
    }

    public void registerSnapshotListener(Consumer<SystemStateSnapshot> listener) {
        snapshotListeners.add(listener);
    }

    public void unregisterSnapshotListener(Consumer<SystemStateSnapshot> listener) {
        snapshotListeners.remove(listener);
    }

    /**
     * 1 Hz Telemetry Synthesis and Dispatch loop executed on Virtual Threads.
     */
    @Scheduled(fixedRate = 1000)
    public void generateAndDispatchTelemetry() {
        virtualThreadExecutor.submit(() -> {
            try {
                // 1. Advance memory bleed state for any active leaks
                chaosFaultInjectorService.tickMemoryBleed();

                // 2. Fetch all nodes
                List<ServiceNodeEntity> nodes = serviceNodeRepository.findAll();
                if (nodes.isEmpty()) {
                    return;
                }

                ensureStreamConnected();

                long timestampMs = System.currentTimeMillis();

                // 3. Synthesize and evaluate frames per node
                for (ServiceNodeEntity node : nodes) {
                    TelemetryFrame frame = synthesizeFrame(node, timestampMs);
                    latestFrames.put(node.getId(), frame);

                    // Send to Python over gRPC
                    dispatchFrame(frame);
                }

                // 4. Broadcast live snapshot
                broadcastSystemSnapshot();

            } catch (Exception e) {
                log.error("Error in telemetry generation cycle", e);
            }
        });
    }

    /**
     * Synthesizes realistic telemetry combining baselines, direct faults, and cascading blast impacts.
     */
    private TelemetryFrame synthesizeFrame(ServiceNodeEntity node, long timestampMs) {
        String serviceId = node.getId();
        ThreadLocalRandom rand = ThreadLocalRandom.current();

        // Healthy Baselines
        double cpuJitter = rand.nextDouble(18.0, 32.0);
        double threadPoolSat = rand.nextDouble(22.0, 35.0);
        double p95 = rand.nextDouble(30.0, 45.0);
        double p99 = p95 + rand.nextDouble(10.0, 25.0);
        double heapMax = 1024.0;
        double heapUsed = rand.nextDouble(380.0, 440.0);
        double errorRate = rand.nextDouble(0.0, 0.05);
        int activeConnections = rand.nextInt(15, 30);

        // A. Apply direct active chaos fault on this node
        Optional<ActiveFaultState> directFaultOpt = chaosFaultInjectorService.getActiveFault(serviceId);
        if (directFaultOpt.isPresent()) {
            ActiveFaultState fault = directFaultOpt.get();
            double intensity = fault.getIntensityPct() / 100.0;

            switch (fault.getFaultType()) {
                case LATENCY_SPIKE -> {
                    p99 += intensity * 450.0;
                    p95 += intensity * 300.0;
                }
                case SOCKET_EXHAUSTION -> {
                    threadPoolSat = Math.min(99.0, threadPoolSat + (intensity * 65.0));
                    activeConnections += (int) (intensity * 160);
                    p99 += intensity * 150.0;
                }
                case MEMORY_BLEED -> {
                    double accumulatedBleed = chaosFaultInjectorService.getAccumulatedBleedMb(serviceId);
                    heapUsed = Math.min(heapMax * 0.98, heapUsed + accumulatedBleed);
                }
                case CORRUPT_PAYLOAD -> {
                    errorRate = Math.min(45.0, errorRate + (intensity * 25.0));
                    cpuJitter = Math.min(95.0, cpuJitter + (intensity * 40.0));
                }
                default -> {}
            }
        }

        // B. Apply cascading blast-radius propagation from downstream services
        ChaosFaultInjectorService.CascadingImpact cascade = chaosFaultInjectorService.calculateCascadingImpact(serviceId);
        p99 += cascade.additionalLatencyMs();
        p95 += cascade.additionalLatencyMs() * 0.70;
        threadPoolSat = Math.min(99.0, threadPoolSat + cascade.additionalThreadPoolSaturationPct());

        return TelemetryFrame.newBuilder()
                .setServiceId(serviceId)
                .setTimestampMs(timestampMs)
                .setCpuJitterPct(cpuJitter)
                .setThreadPoolSaturationPct(threadPoolSat)
                .setHeapUsedMb(heapUsed)
                .setHeapMaxMb(heapMax)
                .setP95LatencyMs(p95)
                .setP99LatencyMs(p99)
                .setErrorRatePct(errorRate)
                .setActiveConnections(activeConnections)
                .build();
    }

    /**
     * Dispatches a frame to the Python Anomaly Inference Engine.
     */
    private void dispatchFrame(TelemetryFrame frame) {
        if (streamConnected && streamRequestObserver != null) {
            try {
                streamRequestObserver.onNext(frame);
                return;
            } catch (Exception e) {
                log.warn("gRPC stream send failed, falling back to unary call", e);
                streamConnected = false;
            }
        }

        // Unary Fallback
        virtualThreadExecutor.submit(() -> {
            try {
                AnomalyVerdict verdict = inferenceBlockingStub.evaluateSingleFrame(frame);
                handleVerdict(verdict);
            } catch (Exception e) {
                log.debug("Python inference engine unavailable: {}", e.getMessage());
            }
        });
    }

    /**
     * Initializes bidirectional streaming connection to Python gRPC server.
     */
    private synchronized void ensureStreamConnected() {
        if (streamConnected || inferenceAsyncStub == null) {
            return;
        }

        try {
            StreamObserver<AnomalyVerdict> responseObserver = new StreamObserver<>() {
                @Override
                public void onNext(AnomalyVerdict verdict) {
                    handleVerdict(verdict);
                }

                @Override
                public void onError(Throwable t) {
                    log.warn("Bidirectional gRPC stream error from Python engine: {}", t.getMessage());
                    streamConnected = false;
                }

                @Override
                public void onCompleted() {
                    log.info("Bidirectional gRPC stream completed by Python engine");
                    streamConnected = false;
                }
            };

            streamRequestObserver = inferenceAsyncStub.evaluateTelemetryStream(responseObserver);
            streamConnected = true;
            log.info("Established bidirectional gRPC telemetry stream with Python Anomaly Engine (:50052)");
        } catch (Exception e) {
            log.debug("Could not establish bi-directional stream with Python engine: {}", e.getMessage());
            streamConnected = false;
        }
    }

    private void handleVerdict(AnomalyVerdict verdict) {
        latestVerdicts.put(verdict.getServiceId(), verdict);

        // Trigger autonomous remediation if anomaly detected
        if (verdict.getRecommendedAction() != RecommendedAction.NO_OP) {
            virtualThreadExecutor.submit(() -> {
                boolean remediated = meshRemediationService.executeAutonomousRemediation(verdict);
                if (remediated) {
                    broadcastSystemSnapshot();
                }
            });
        }
    }

    /**
     * Constructs and broadcasts real-time system state snapshot.
     */
    public SystemStateSnapshot buildCurrentSnapshot() {
        List<ServiceNodeEntity> nodeEntities = serviceNodeRepository.findAll();
        List<ServiceEdgeEntity> edgeEntities = serviceEdgeRepository.findAll();

        List<ServiceNodeStatus> nodeStatuses = new ArrayList<>();
        for (ServiceNodeEntity node : nodeEntities) {
            String serviceId = node.getId();
            TelemetryFrame telemetry = latestFrames.getOrDefault(serviceId, TelemetryFrame.getDefaultInstance());
            AnomalyVerdict verdict = latestVerdicts.getOrDefault(serviceId, AnomalyVerdict.getDefaultInstance());

            // Circuit State
            io.github.resilience4j.circuitbreaker.CircuitBreaker.State cbState =
                    meshRemediationService.getCircuitBreakerState(serviceId);
            CircuitState protoCircuitState = switch (cbState) {
                case OPEN, FORCED_OPEN -> CircuitState.OPEN;
                case HALF_OPEN -> CircuitState.HALF_OPEN;
                default -> CircuitState.CLOSED;
            };

            // Active Faults
            List<ActiveFault> protoFaults = new ArrayList<>();
            chaosFaultInjectorService.getActiveFault(serviceId).ifPresent(f -> {
                protoFaults.add(ActiveFault.newBuilder()
                        .setFaultType(f.getFaultType())
                        .setIntensityPct(f.getIntensityPct())
                        .setStartedAtMs(f.getStartedAtMs())
                        .setDurationSeconds(f.getDurationSeconds())
                        .setRemainingSeconds(f.getRemainingSeconds())
                        .build());
            });

            // Route Weights (derived from incoming edges)
            double primary = 100.0, canary = 0.0, cold = 0.0;
            for (ServiceEdgeEntity edge : edgeEntities) {
                if (edge.getTargetServiceId().equals(serviceId)) {
                    primary = edge.getPrimaryWeightPct().doubleValue();
                    canary = edge.getCanaryWeightPct().doubleValue();
                    cold = edge.getColdReplicaWeightPct().doubleValue();
                    break;
                }
            }

            nodeStatuses.add(ServiceNodeStatus.newBuilder()
                    .setServiceId(serviceId)
                    .setCircuitState(protoCircuitState)
                    .setCurrentRouteWeights(RouteWeights.newBuilder()
                            .setPrimaryWeightPct(primary)
                            .setCanaryWeightPct(canary)
                            .setColdReplicaWeightPct(cold)
                            .build())
                    .addAllActiveFaults(protoFaults)
                    .setLatestTelemetry(telemetry)
                    .setLatestVerdict(verdict)
                    .build());
        }

        List<RouteWeightUpdate> activeRoutes = edgeEntities.stream().map(edge -> RouteWeightUpdate.newBuilder()
                .setSourceServiceId(edge.getSourceServiceId())
                .setTargetServiceId(edge.getTargetServiceId())
                .setPrimaryWeightPct(edge.getPrimaryWeightPct().doubleValue())
                .setCanaryWeightPct(edge.getCanaryWeightPct().doubleValue())
                .setColdReplicaWeightPct(edge.getColdReplicaWeightPct().doubleValue())
                .setThrottleNonCritical(edge.getColdReplicaWeightPct().doubleValue() > 0)
                .setReason("Current Active Routing")
                .build()).toList();

        return SystemStateSnapshot.newBuilder()
                .setSnapshotTimestampMs(System.currentTimeMillis())
                .addAllNodes(nodeStatuses)
                .addAllActiveRoutes(activeRoutes)
                .build();
    }

    public void broadcastSystemSnapshot() {
        if (snapshotListeners.isEmpty()) {
            return;
        }

        SystemStateSnapshot snapshot = buildCurrentSnapshot();
        for (Consumer<SystemStateSnapshot> listener : snapshotListeners) {
            try {
                listener.accept(snapshot);
            } catch (Exception e) {
                log.debug("Error delivering snapshot to listener: {}", e.getMessage());
            }
        }
    }

    public Map<String, TelemetryFrame> getLatestFrames() {
        return Collections.unmodifiableMap(latestFrames);
    }

    public Map<String, AnomalyVerdict> getLatestVerdicts() {
        return Collections.unmodifiableMap(latestVerdicts);
    }
}
