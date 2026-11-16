package com.vektormesh.engine.controller;

import ai.vektormesh.v1.FaultType;
import ai.vektormesh.v1.RouteWeightUpdate;
import com.vektormesh.engine.audit.AuditLedgerVerificationService;
import com.vektormesh.engine.chaos.ChaosFaultInjectorService;
import com.vektormesh.engine.control.MeshRemediationService;
import com.vektormesh.engine.domain.AuditLedgerEntry;
import com.vektormesh.engine.domain.LedgerIntegrityReport;
import com.vektormesh.engine.domain.ServiceEdgeEntity;
import com.vektormesh.engine.domain.ServiceNodeEntity;
import com.vektormesh.engine.repository.AuditLedgerRepository;
import com.vektormesh.engine.repository.ServiceEdgeRepository;
import com.vektormesh.engine.repository.ServiceNodeRepository;
import com.vektormesh.engine.telemetry.TelemetryOrchestrator;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * REST Management & Topology Controller for VektorMesh.
 * Provides live topology queries, cryptographic ledger verification reports,
 * chaos injection triggers, and manual route weight overrides.
 */
@RestController
@RequestMapping("/api/v1")
@CrossOrigin(origins = "*")
public class MeshManagementController {

    private final ServiceNodeRepository serviceNodeRepository;
    private final ServiceEdgeRepository serviceEdgeRepository;
    private final AuditLedgerRepository auditLedgerRepository;
    private final AuditLedgerVerificationService auditLedgerVerificationService;
    private final ChaosFaultInjectorService chaosFaultInjectorService;
    private final MeshRemediationService meshRemediationService;
    private final TelemetryOrchestrator telemetryOrchestrator;

    public MeshManagementController(
            ServiceNodeRepository serviceNodeRepository,
            ServiceEdgeRepository serviceEdgeRepository,
            AuditLedgerRepository auditLedgerRepository,
            AuditLedgerVerificationService auditLedgerVerificationService,
            ChaosFaultInjectorService chaosFaultInjectorService,
            MeshRemediationService meshRemediationService,
            TelemetryOrchestrator telemetryOrchestrator
    ) {
        this.serviceNodeRepository = serviceNodeRepository;
        this.serviceEdgeRepository = serviceEdgeRepository;
        this.auditLedgerRepository = auditLedgerRepository;
        this.auditLedgerVerificationService = auditLedgerVerificationService;
        this.chaosFaultInjectorService = chaosFaultInjectorService;
        this.meshRemediationService = meshRemediationService;
        this.telemetryOrchestrator = telemetryOrchestrator;
    }

    /**
     * GET /api/v1/topology: Current nodes, edges, live telemetry, and active faults.
     */
    @GetMapping("/topology")
    public ResponseEntity<Map<String, Object>> getTopology() {
        List<ServiceNodeEntity> nodes = serviceNodeRepository.findAll();
        List<ServiceEdgeEntity> edges = serviceEdgeRepository.findAll();

        var latestFrames = telemetryOrchestrator.getLatestFrames();
        var latestVerdicts = telemetryOrchestrator.getLatestVerdicts();
        var activeFaults = chaosFaultInjectorService.getAllActiveFaults();

        List<Map<String, Object>> nodeData = nodes.stream().map(node -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", node.getId());
            map.put("name", node.getServiceName());
            map.put("tier", node.getTier());
            map.put("baseUrl", node.getBaseUrl());
            map.put("maxThreadPool", node.getMaxThreadPool());
            map.put("sloP99Ms", node.getSloP99Ms());
            map.put("circuitState", meshRemediationService.getCircuitBreakerState(node.getId()).name());

            var frame = latestFrames.get(node.getId());
            if (frame != null) {
                map.put("telemetry", Map.of(
                        "cpuJitterPct", Math.round(frame.getCpuJitterPct() * 100.0) / 100.0,
                        "threadPoolSaturationPct", Math.round(frame.getThreadPoolSaturationPct() * 100.0) / 100.0,
                        "heapUsedMb", Math.round(frame.getHeapUsedMb() * 10.0) / 10.0,
                        "heapMaxMb", frame.getHeapMaxMb(),
                        "p95LatencyMs", Math.round(frame.getP95LatencyMs() * 10.0) / 10.0,
                        "p99LatencyMs", Math.round(frame.getP99LatencyMs() * 10.0) / 10.0,
                        "errorRatePct", Math.round(frame.getErrorRatePct() * 100.0) / 100.0,
                        "activeConnections", frame.getActiveConnections()
                ));
            }

            var verdict = latestVerdicts.get(node.getId());
            if (verdict != null) {
                map.put("verdict", Map.of(
                        "cascadeProbability", verdict.getCascadeProbability(),
                        "ewmaZScore", verdict.getEwmaZScore(),
                        "isolationForestScore", verdict.getIsolationForestScore(),
                        "rootCause", verdict.getRootCauseMetric().name(),
                        "recommendedAction", verdict.getRecommendedAction().name()
                ));
            }

            var fault = activeFaults.get(node.getId());
            if (fault != null) {
                map.put("activeFault", Map.of(
                        "faultType", fault.getFaultType().name(),
                        "intensityPct", fault.getIntensityPct(),
                        "remainingSeconds", fault.getRemainingSeconds()
                ));
            }

            return map;
        }).toList();

        return ResponseEntity.ok(Map.of(
                "nodes", nodeData,
                "edges", edges,
                "timestamp", System.currentTimeMillis()
        ));
    }

    /**
     * GET /api/v1/audit-ledger: Returns cryptographic ledger integrity report & latest 100 records.
     */
    @GetMapping("/audit-ledger")
    public ResponseEntity<Map<String, Object>> getAuditLedger() {
        LedgerIntegrityReport report = auditLedgerVerificationService.verifyLedgerIntegrity();
        List<AuditLedgerEntry> latest100 = auditLedgerRepository.findLatest100();

        return ResponseEntity.ok(Map.of(
                "integrityReport", report,
                "recentEntries", latest100
        ));
    }

    /**
     * POST /api/v1/chaos/inject: Injects a synthetic chaos fault.
     */
    @PostMapping("/chaos/inject")
    public ResponseEntity<Map<String, Object>> injectFault(@Valid @RequestBody ChaosInjectionRequest req) {
        FaultType protoType;
        try {
            protoType = FaultType.valueOf(req.getFaultType().toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid fault type: " + req.getFaultType()));
        }

        var fault = chaosFaultInjectorService.injectFault(
                req.getTargetServiceId(),
                protoType,
                req.getIntensityPct(),
                req.getDurationSeconds()
        );

        telemetryOrchestrator.broadcastSystemSnapshot();

        return ResponseEntity.ok(Map.of(
                "status", "INJECTED",
                "serviceId", fault.getTargetServiceId(),
                "faultType", fault.getFaultType().name(),
                "intensityPct", fault.getIntensityPct(),
                "durationSeconds", fault.getDurationSeconds()
        ));
    }

    /**
     * POST /api/v1/control/weights: Overrides route weights manually.
     */
    @PostMapping("/control/weights")
    public ResponseEntity<Map<String, Object>> overrideWeights(@Valid @RequestBody WeightOverrideRequest req) {
        RouteWeightUpdate update = RouteWeightUpdate.newBuilder()
                .setSourceServiceId(req.getSourceServiceId())
                .setTargetServiceId(req.getTargetServiceId())
                .setPrimaryWeightPct(req.getPrimaryWeightPct())
                .setCanaryWeightPct(req.getCanaryWeightPct())
                .setColdReplicaWeightPct(req.getColdReplicaWeightPct())
                .setThrottleNonCritical(req.isThrottleNonCritical())
                .setReason(req.getReason() != null ? req.getReason() : "REST API Override")
                .build();

        boolean success = meshRemediationService.applyManualRouteOverride(update);
        telemetryOrchestrator.broadcastSystemSnapshot();

        if (success) {
            return ResponseEntity.ok(Map.of("status", "UPDATED", "request", req));
        } else {
            return ResponseEntity.badRequest().body(Map.of("error", "Route edge not found between source and target"));
        }
    }

    /**
     * POST /api/v1/control/reset/{serviceId}: Clears active faults, resets circuit breaker to CLOSED, restores healthy route weights.
     */
    @PostMapping("/control/reset/{serviceId}")
    public ResponseEntity<Map<String, Object>> resetService(@PathVariable String serviceId) {
        boolean reset = meshRemediationService.applyContainerSelfHealing(serviceId, null);
        telemetryOrchestrator.broadcastSystemSnapshot();

        return ResponseEntity.ok(Map.of(
                "status", "RESET_COMPLETE",
                "serviceId", serviceId,
                "circuitBreaker", "CLOSED",
                "faultsCleared", true
        ));
    }

    // --- DTOs ---

    @Data
    public static class ChaosInjectionRequest {
        @NotBlank
        private String targetServiceId;

        @NotBlank
        private String faultType;

        @Min(1) @Max(100)
        private int intensityPct;

        @Min(5) @Max(3600)
        private int durationSeconds;
    }

    @Data
    public static class WeightOverrideRequest {
        @NotBlank
        private String sourceServiceId;

        @NotBlank
        private String targetServiceId;

        @NotNull
        private Double primaryWeightPct;

        @NotNull
        private Double canaryWeightPct;

        @NotNull
        private Double coldReplicaWeightPct;

        private boolean throttleNonCritical;

        private String reason;
    }
}
