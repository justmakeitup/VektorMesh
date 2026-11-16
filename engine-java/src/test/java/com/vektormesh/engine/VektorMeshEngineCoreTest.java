package com.vektormesh.engine;

import ai.vektormesh.v1.FaultType;
import com.vektormesh.engine.audit.AuditLedgerVerificationService;
import com.vektormesh.engine.chaos.ChaosFaultInjectorService;
import com.vektormesh.engine.domain.AuditLedgerEntry;
import com.vektormesh.engine.domain.LedgerIntegrityReport;
import com.vektormesh.engine.domain.ServiceEdgeEntity;
import com.vektormesh.engine.repository.AuditLedgerRepository;
import com.vektormesh.engine.repository.ServiceEdgeRepository;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

class VektorMeshEngineCoreTest {

    private ServiceEdgeRepository serviceEdgeRepository;
    private AuditLedgerRepository auditLedgerRepository;
    private ChaosFaultInjectorService chaosService;
    private AuditLedgerVerificationService verificationService;

    @BeforeEach
    void setUp() {
        serviceEdgeRepository = Mockito.mock(ServiceEdgeRepository.class);
        auditLedgerRepository = Mockito.mock(AuditLedgerRepository.class);
        chaosService = new ChaosFaultInjectorService(
                serviceEdgeRepository,
                auditLedgerRepository,
                Executors.newVirtualThreadPerTaskExecutor()
        );
        verificationService = new AuditLedgerVerificationService(auditLedgerRepository);
    }

    @Test
    @DisplayName("Verify Chaos Fault Injection and Expiration tracking")
    void testChaosFaultLifecycle() {
        var fault = chaosService.injectFault("payment-ledger", FaultType.LATENCY_SPIKE, 80, 5);
        assertNotNull(fault);
        assertEquals("payment-ledger", fault.getTargetServiceId());
        assertEquals(FaultType.LATENCY_SPIKE, fault.getFaultType());
        assertEquals(80, fault.getIntensityPct());
        assertFalse(fault.isExpired());
        assertTrue(fault.getRemainingSeconds() > 0);

        var retrieved = chaosService.getActiveFault("payment-ledger");
        assertTrue(retrieved.isPresent());

        chaosService.clearFault("payment-ledger");
        assertTrue(chaosService.getActiveFault("payment-ledger").isEmpty());
    }

    @Test
    @DisplayName("Verify Cascading Blast Radius Propagation when Circuit is CLOSED vs OPEN")
    void testCascadingBlastRadiusPropagation() {
        // Downstream target 'inventory-db-proxy' has an active SOCKET_EXHAUSTION fault
        chaosService.injectFault("inventory-db-proxy", FaultType.SOCKET_EXHAUSTION, 90, 60);

        // Edge: order-processor -> inventory-db-proxy
        ServiceEdgeEntity edgeClosed = ServiceEdgeEntity.builder()
                .id(1L)
                .sourceServiceId("order-processor")
                .targetServiceId("inventory-db-proxy")
                .protocol("GRPC")
                .primaryWeightPct(BigDecimal.valueOf(100.0))
                .canaryWeightPct(BigDecimal.ZERO)
                .coldReplicaWeightPct(BigDecimal.ZERO)
                .circuitState("CLOSED")
                .build();

        when(serviceEdgeRepository.findBySourceServiceId("order-processor"))
                .thenReturn(List.of(edgeClosed));

        // When circuit is CLOSED: failure propagates upstream to order-processor!
        var impactClosed = chaosService.calculateCascadingImpact("order-processor");
        assertTrue(impactClosed.additionalLatencyMs() > 0, "Latency must cascade upstream when circuit is CLOSED");
        assertTrue(impactClosed.additionalThreadPoolSaturationPct() > 0, "Thread pool saturation must cascade upstream");

        // When circuit is OPEN: blast radius is severed completely!
        ServiceEdgeEntity edgeOpen = ServiceEdgeEntity.builder()
                .id(1L)
                .sourceServiceId("order-processor")
                .targetServiceId("inventory-db-proxy")
                .protocol("GRPC")
                .primaryWeightPct(BigDecimal.valueOf(100.0))
                .canaryWeightPct(BigDecimal.ZERO)
                .coldReplicaWeightPct(BigDecimal.ZERO)
                .circuitState("OPEN")
                .build();

        when(serviceEdgeRepository.findBySourceServiceId("order-processor"))
                .thenReturn(List.of(edgeOpen));

        var impactOpen = chaosService.calculateCascadingImpact("order-processor");
        assertEquals(0.0, impactOpen.additionalLatencyMs(), "Cascading latency must be zero when circuit is OPEN");
        assertEquals(0.0, impactOpen.additionalThreadPoolSaturationPct(), "Cascading thread saturation must be zero when circuit is OPEN");
    }

    @Test
    @DisplayName("Verify Cryptographic Audit Ledger SHA-256 Hash Chain Verification")
    void testAuditLedgerVerification() {
        String genesisHash = AuditLedgerVerificationService.computeSha256("genesis-block-data");
        String block1Hash = AuditLedgerVerificationService.computeSha256("block-1-data" + genesisHash);

        AuditLedgerEntry genesis = AuditLedgerEntry.builder()
                .sequenceId(1L)
                .eventId("00000000-0000-0000-0000-000000000000")
                .timestampUtc(LocalDateTime.now())
                .serviceId("api-gateway")
                .actionType("NO_OP")
                .triggerSource("AUTONOMOUS_AI")
                .cascadeProbability(BigDecimal.ZERO)
                .payloadJson("{}")
                .prevHash("0".repeat(64))
                .currHash(genesisHash)
                .build();

        AuditLedgerEntry block1 = AuditLedgerEntry.builder()
                .sequenceId(2L)
                .eventId("11111111-1111-1111-1111-111111111111")
                .timestampUtc(LocalDateTime.now())
                .serviceId("order-processor")
                .actionType("THROTTLE_TRAFFIC")
                .triggerSource("AUTONOMOUS_AI")
                .cascadeProbability(BigDecimal.valueOf(0.75))
                .payloadJson("{\"action\":\"THROTTLE\"}")
                .prevHash(genesisHash)
                .currHash(block1Hash)
                .build();

        when(auditLedgerRepository.findAllOrderedBySequence()).thenReturn(List.of(genesis, block1));

        LedgerIntegrityReport report = verificationService.verifyLedgerIntegrity();
        assertTrue(report.isValid(), "Audit ledger hash chain must be valid");
        assertEquals(2, report.getTotalRecords());
        assertEquals(block1Hash, report.getLastVerifiedHash());
        assertNull(report.getTamperedSequenceId());

        // Introduce tamper: alter prevHash of block 1
        AuditLedgerEntry tamperedBlock1 = AuditLedgerEntry.builder()
                .sequenceId(2L)
                .eventId("11111111-1111-1111-1111-111111111111")
                .timestampUtc(LocalDateTime.now())
                .serviceId("order-processor")
                .actionType("THROTTLE_TRAFFIC")
                .triggerSource("AUTONOMOUS_AI")
                .cascadeProbability(BigDecimal.valueOf(0.75))
                .payloadJson("{\"action\":\"THROTTLE\"}")
                .prevHash("bad-hash".repeat(8)) // Tampered!
                .currHash(block1Hash)
                .build();

        when(auditLedgerRepository.findAllOrderedBySequence()).thenReturn(List.of(genesis, tamperedBlock1));

        LedgerIntegrityReport tamperedReport = verificationService.verifyLedgerIntegrity();
        assertFalse(tamperedReport.isValid(), "Tampered ledger must be flagged invalid");
        assertEquals(2L, tamperedReport.getTamperedSequenceId(), "Must identify exact tampered sequence ID");
    }

    @Test
    @DisplayName("Verify Resilience4j Circuit Breaker State Transitions")
    void testCircuitBreakerTransitions() {
        CircuitBreakerRegistry registry = CircuitBreakerRegistry.of(CircuitBreakerConfig.ofDefaults());
        CircuitBreaker cb = registry.circuitBreaker("auth-service");

        assertEquals(CircuitBreaker.State.CLOSED, cb.getState());
        cb.transitionToOpenState();
        assertEquals(CircuitBreaker.State.OPEN, cb.getState());
        cb.transitionToHalfOpenState();
        assertEquals(CircuitBreaker.State.HALF_OPEN, cb.getState());
        cb.transitionToClosedState();
        assertEquals(CircuitBreaker.State.CLOSED, cb.getState());
    }
}
