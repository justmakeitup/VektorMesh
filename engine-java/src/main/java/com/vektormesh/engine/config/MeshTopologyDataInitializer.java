package com.vektormesh.engine.config;

import com.vektormesh.engine.domain.ServiceEdgeEntity;
import com.vektormesh.engine.domain.ServiceNodeEntity;
import com.vektormesh.engine.repository.ServiceEdgeRepository;
import com.vektormesh.engine.repository.ServiceNodeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

/**
 * Ensures baseline topology seed nodes and edges exist upon startup.
 */
@Component
public class MeshTopologyDataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(MeshTopologyDataInitializer.class);

    private final ServiceNodeRepository serviceNodeRepository;
    private final ServiceEdgeRepository serviceEdgeRepository;

    public MeshTopologyDataInitializer(
            ServiceNodeRepository serviceNodeRepository,
            ServiceEdgeRepository serviceEdgeRepository
    ) {
        this.serviceNodeRepository = serviceNodeRepository;
        this.serviceEdgeRepository = serviceEdgeRepository;
    }

    @Override
    public void run(String... args) {
        if (serviceNodeRepository.count() == 0) {
            log.info("No service nodes found in database. Initializing default 6-node mesh topology...");

            var nodes = List.of(
                    ServiceNodeEntity.builder().id("api-gateway").serviceName("Vektor Gateway Proxy").tier("EDGE").baseUrl("http://api-gateway:8080").maxThreadPool(200).sloP99Ms(new BigDecimal("120.00")).build(),
                    ServiceNodeEntity.builder().id("auth-service").serviceName("Security & Token Authority").tier("CORE").baseUrl("http://auth-service:8081").maxThreadPool(100).sloP99Ms(new BigDecimal("80.00")).build(),
                    ServiceNodeEntity.builder().id("order-processor").serviceName("Core Order State Machine").tier("CORE").baseUrl("http://order-processor:8082").maxThreadPool(150).sloP99Ms(new BigDecimal("250.00")).build(),
                    ServiceNodeEntity.builder().id("payment-ledger").serviceName("Immutable Financial Ledger").tier("CRITICAL").baseUrl("http://payment-ledger:8083").maxThreadPool(80).sloP99Ms(new BigDecimal("300.00")).build(),
                    ServiceNodeEntity.builder().id("inventory-db-proxy").serviceName("Inventory Partition Proxy").tier("DATA").baseUrl("http://inventory-db-proxy:8084").maxThreadPool(120).sloP99Ms(new BigDecimal("150.00")).build(),
                    ServiceNodeEntity.builder().id("notification-worker").serviceName("Async Notification Dispatch").tier("ASYNC").baseUrl("http://notification-worker:8085").maxThreadPool(50).sloP99Ms(new BigDecimal("500.00")).build()
            );

            serviceNodeRepository.saveAll(nodes);

            var edges = List.of(
                    ServiceEdgeEntity.builder().sourceServiceId("api-gateway").targetServiceId("auth-service").protocol("GRPC").primaryWeightPct(new BigDecimal("100.00")).canaryWeightPct(BigDecimal.ZERO).coldReplicaWeightPct(BigDecimal.ZERO).circuitState("CLOSED").build(),
                    ServiceEdgeEntity.builder().sourceServiceId("api-gateway").targetServiceId("order-processor").protocol("GRPC").primaryWeightPct(new BigDecimal("100.00")).canaryWeightPct(BigDecimal.ZERO).coldReplicaWeightPct(BigDecimal.ZERO).circuitState("CLOSED").build(),
                    ServiceEdgeEntity.builder().sourceServiceId("order-processor").targetServiceId("payment-ledger").protocol("GRPC").primaryWeightPct(new BigDecimal("100.00")).canaryWeightPct(BigDecimal.ZERO).coldReplicaWeightPct(BigDecimal.ZERO).circuitState("CLOSED").build(),
                    ServiceEdgeEntity.builder().sourceServiceId("order-processor").targetServiceId("inventory-db-proxy").protocol("GRPC").primaryWeightPct(new BigDecimal("100.00")).canaryWeightPct(BigDecimal.ZERO).coldReplicaWeightPct(BigDecimal.ZERO).circuitState("CLOSED").build(),
                    ServiceEdgeEntity.builder().sourceServiceId("order-processor").targetServiceId("notification-worker").protocol("GRPC").primaryWeightPct(new BigDecimal("100.00")).canaryWeightPct(BigDecimal.ZERO).coldReplicaWeightPct(BigDecimal.ZERO).circuitState("CLOSED").build()
            );

            serviceEdgeRepository.saveAll(edges);
            log.info("Initialized {} service nodes and {} directed edges successfully.", nodes.size(), edges.size());
        }
    }
}
