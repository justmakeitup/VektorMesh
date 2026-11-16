package com.vektormesh.engine;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * VektorMesh Core Execution &amp; Chaos Engine.
 * Transactional heart of the self-healing microservice canary mesh.
 */
@SpringBootApplication
@EnableScheduling
public class VektorMeshEngineApplication {

    private static final Logger log = LoggerFactory.getLogger(VektorMeshEngineApplication.class);

    public static void main(String[] args) {
        SpringApplication.run(VektorMeshEngineApplication.class, args);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        log.info("=================================================================");
        log.info("  VektorMesh Core Execution & Chaos Engine (Java 21) Started    ");
        log.info("  Virtual Threads Enabled: true                                  ");
        log.info("  REST Management API:      http://localhost:8080/api/v1/topology ");
        log.info("  gRPC Mesh Control Plane:  grpc://localhost:9090                ");
        log.info("=================================================================");
    }
}
