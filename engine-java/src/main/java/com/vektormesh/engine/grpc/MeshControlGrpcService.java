package com.vektormesh.engine.grpc;

import ai.vektormesh.v1.*;
import com.google.protobuf.Empty;
import com.vektormesh.engine.chaos.ChaosFaultInjectorService;
import com.vektormesh.engine.control.MeshRemediationService;
import com.vektormesh.engine.telemetry.TelemetryOrchestrator;
import io.grpc.stub.ServerCallStreamObserver;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.UUID;
import java.util.function.Consumer;

/**
 * gRPC Server Implementation of MeshControlService (listening on port 9090).
 * Provides server-streaming topology snapshots, manual fault injections, and route overrides.
 */
@GrpcService
public class MeshControlGrpcService extends MeshControlServiceGrpc.MeshControlServiceImplBase {

    private static final Logger log = LoggerFactory.getLogger(MeshControlGrpcService.class);

    private final TelemetryOrchestrator telemetryOrchestrator;
    private final ChaosFaultInjectorService chaosFaultInjectorService;
    private final MeshRemediationService meshRemediationService;

    public MeshControlGrpcService(
            TelemetryOrchestrator telemetryOrchestrator,
            ChaosFaultInjectorService chaosFaultInjectorService,
            MeshRemediationService meshRemediationService
    ) {
        this.telemetryOrchestrator = telemetryOrchestrator;
        this.chaosFaultInjectorService = chaosFaultInjectorService;
        this.meshRemediationService = meshRemediationService;
    }

    @Override
    public void streamSystemState(Empty request, StreamObserver<SystemStateSnapshot> responseObserver) {
        log.info("Client subscribed to streamSystemState");

        ServerCallStreamObserver<SystemStateSnapshot> serverObserver =
                (ServerCallStreamObserver<SystemStateSnapshot>) responseObserver;

        // Consumer listener pushing live snapshots to this subscriber
        Consumer<SystemStateSnapshot> listener = snapshot -> {
            try {
                synchronized (serverObserver) {
                    if (!serverObserver.isCancelled()) {
                        serverObserver.onNext(snapshot);
                    }
                }
            } catch (Exception e) {
                log.debug("Snapshot streamObserver push failed: {}", e.getMessage());
            }
        };

        // Push immediate initial snapshot
        listener.accept(telemetryOrchestrator.buildCurrentSnapshot());

        telemetryOrchestrator.registerSnapshotListener(listener);

        serverObserver.setOnCancelHandler(() -> {
            log.info("Client cancelled streamSystemState subscription");
            telemetryOrchestrator.unregisterSnapshotListener(listener);
        });
    }

    @Override
    public void applyRemediation(AnomalyVerdict request, StreamObserver<RemediationAck> responseObserver) {
        boolean executed = meshRemediationService.executeAutonomousRemediation(request);
        telemetryOrchestrator.broadcastSystemSnapshot();

        RemediationAck ack = RemediationAck.newBuilder()
                .setSuccess(executed)
                .setRemediationId(UUID.randomUUID().toString())
                .setMessage(executed ? "Remediation successfully applied" : "Remediation skipped (cooldown or NO_OP)")
                .setAppliedAtMs(System.currentTimeMillis())
                .build();

        responseObserver.onNext(ack);
        responseObserver.onCompleted();
    }

    @Override
    public void triggerChaosFault(FaultInjectionRequest request, StreamObserver<RemediationAck> responseObserver) {
        chaosFaultInjectorService.injectFault(
                request.getTargetServiceId(),
                request.getFaultType(),
                request.getIntensityPct(),
                request.getDurationSeconds()
        );

        telemetryOrchestrator.broadcastSystemSnapshot();

        RemediationAck ack = RemediationAck.newBuilder()
                .setSuccess(true)
                .setRemediationId(UUID.randomUUID().toString())
                .setMessage(String.format("Fault %s injected into %s for %ds",
                        request.getFaultType(), request.getTargetServiceId(), request.getDurationSeconds()))
                .setAppliedAtMs(System.currentTimeMillis())
                .build();

        responseObserver.onNext(ack);
        responseObserver.onCompleted();
    }

    @Override
    public void overrideRouteWeights(RouteWeightUpdate request, StreamObserver<RemediationAck> responseObserver) {
        boolean success = meshRemediationService.applyManualRouteOverride(request);
        telemetryOrchestrator.broadcastSystemSnapshot();

        RemediationAck ack = RemediationAck.newBuilder()
                .setSuccess(success)
                .setRemediationId(UUID.randomUUID().toString())
                .setMessage(success ? "Route weights successfully overridden" : "Failed to find matching route edge")
                .setAppliedAtMs(System.currentTimeMillis())
                .build();

        responseObserver.onNext(ack);
        responseObserver.onCompleted();
    }
}
