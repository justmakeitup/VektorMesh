-- ============================================================================
-- VektorMesh Control Plane Database Schema & Cryptographic Audit Ledger
-- Database Engine: MySQL 8.0+ (InnoDB)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS vektormesh
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE vektormesh;

-- ============================================================================
-- Table: service_nodes
-- Metadata and baseline SLO definitions for microservice mesh nodes
-- ============================================================================
DROP TABLE IF EXISTS service_edges;
DROP TABLE IF EXISTS slo_compliance_rollups;
DROP TABLE IF EXISTS remediation_audit_ledger;
DROP TABLE IF EXISTS service_nodes;

CREATE TABLE service_nodes (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    service_name VARCHAR(128) NOT NULL,
    tier ENUM('EDGE', 'CORE', 'DATA', 'CRITICAL', 'ASYNC') NOT NULL,
    base_url VARCHAR(255) NOT NULL,
    max_thread_pool INT UNSIGNED NOT NULL DEFAULT 100,
    slo_p99_ms DECIMAL(8,2) NOT NULL DEFAULT 200.00,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    INDEX idx_service_tier (tier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table: service_edges
-- Directed graph topology, routing weights, and circuit breaker status
-- ============================================================================
CREATE TABLE service_edges (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    source_service_id VARCHAR(64) NOT NULL,
    target_service_id VARCHAR(64) NOT NULL,
    protocol VARCHAR(32) NOT NULL DEFAULT 'GRPC',
    primary_weight_pct DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    canary_weight_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    cold_replica_weight_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    circuit_state ENUM('CLOSED', 'OPEN', 'HALF_OPEN') NOT NULL DEFAULT 'CLOSED',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_edge_source FOREIGN KEY (source_service_id)
        REFERENCES service_nodes(id) ON DELETE CASCADE,
    CONSTRAINT fk_edge_target FOREIGN KEY (target_service_id)
        REFERENCES service_nodes(id) ON DELETE CASCADE,
    CONSTRAINT uq_source_target UNIQUE (source_service_id, target_service_id),
    CONSTRAINT chk_routing_weights CHECK (
        (primary_weight_pct + canary_weight_pct + cold_replica_weight_pct) <= 100.01
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table: slo_compliance_rollups
-- 1-minute historical rollups of telemetry and error budget consumption
-- ============================================================================
CREATE TABLE slo_compliance_rollups (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id VARCHAR(64) NOT NULL,
    window_start DATETIME(6) NOT NULL,
    avg_p99_ms DECIMAL(8,2) NOT NULL,
    error_budget_burned_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    anomalies_detected INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_rollup_service FOREIGN KEY (service_id)
        REFERENCES service_nodes(id) ON DELETE CASCADE,
    INDEX idx_service_window (service_id, window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table: remediation_audit_ledger
-- Cryptographically hash-chained append-only ledger for immutable compliance
-- ============================================================================
CREATE TABLE remediation_audit_ledger (
    sequence_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_id CHAR(36) NOT NULL,
    timestamp_utc DATETIME(6) NOT NULL,
    service_id VARCHAR(64) NOT NULL,
    action_type ENUM(
        'NO_OP',
        'THROTTLE_TRAFFIC',
        'OPEN_CIRCUIT',
        'REROUTE_COLD_REPLICA',
        'RESTART_CONTAINER',
        'CHAOS_INJECTION',
        'MANUAL_ROUTE_OVERRIDE'
    ) NOT NULL,
    trigger_source ENUM('AUTONOMOUS_AI', 'MANUAL_OVERRIDE', 'CHAOS_INJECTOR') NOT NULL,
    cascade_probability DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
    payload_json JSON NOT NULL,
    prev_hash CHAR(64) NOT NULL,
    curr_hash CHAR(64) NOT NULL UNIQUE,
    INDEX idx_audit_service (service_id),
    INDEX idx_audit_timestamp (timestamp_utc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Cryptographic Triggers for remediation_audit_ledger
-- ============================================================================

DELIMITER $$

-- Trigger: trg_audit_ledger_hash_chain
-- Automatically computes SHA-256 hash chains across previous hash and current event tuple
CREATE TRIGGER trg_audit_ledger_hash_chain
BEFORE INSERT ON remediation_audit_ledger
FOR EACH ROW
BEGIN
    DECLARE last_hash CHAR(64);

    -- Ensure UUID event_id exists
    IF NEW.event_id IS NULL OR NEW.event_id = '' THEN
        SET NEW.event_id = UUID();
    END IF;

    -- Ensure UTC microsecond timestamp exists
    IF NEW.timestamp_utc IS NULL THEN
        SET NEW.timestamp_utc = UTC_TIMESTAMP(6);
    END IF;

    -- Fetch the hash of the latest inserted ledger entry
    SELECT curr_hash INTO last_hash
    FROM remediation_audit_ledger
    ORDER BY sequence_id DESC
    LIMIT 1;

    -- Genesis block condition: set 64 zeros if table is empty
    IF last_hash IS NULL THEN
        SET NEW.prev_hash = '0000000000000000000000000000000000000000000000000000000000000000';
    ELSE
        SET NEW.prev_hash = last_hash;
    END IF;

    -- Compute deterministic SHA-256 digest linking payload to entire prior chain
    SET NEW.curr_hash = SHA2(
        CONCAT(
            NEW.event_id,
            DATE_FORMAT(NEW.timestamp_utc, '%Y-%m-%d %H:%i:%s.%f'),
            NEW.service_id,
            NEW.action_type,
            NEW.payload_json,
            NEW.prev_hash
        ),
        256
    );
END$$

-- Trigger: trg_audit_ledger_no_update
-- Forbids any record modifications on the audit ledger
CREATE TRIGGER trg_audit_ledger_no_update
BEFORE UPDATE ON remediation_audit_ledger
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Immutable Audit Ledger: Modifications and deletions are strictly prohibited';
END$$

-- Trigger: trg_audit_ledger_no_delete
-- Forbids any record deletions from the audit ledger
CREATE TRIGGER trg_audit_ledger_no_delete
BEFORE DELETE ON remediation_audit_ledger
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Immutable Audit Ledger: Modifications and deletions are strictly prohibited';
END$$

DELIMITER ;

-- ============================================================================
-- Seed Data: 6-Node Production Mesh Topology
-- ============================================================================

INSERT INTO service_nodes (id, service_name, tier, base_url, max_thread_pool, slo_p99_ms) VALUES
('api-gateway',         'Vektor Gateway Proxy',       'EDGE',     'http://api-gateway:8080',         200, 120.00),
('auth-service',        'Security & Token Authority', 'CORE',     'http://auth-service:8081',        100,  80.00),
('order-processor',     'Core Order State Machine',   'CORE',     'http://order-processor:8082',     150, 250.00),
('payment-ledger',      'Immutable Financial Ledger', 'CRITICAL', 'http://payment-ledger:8083',       80, 300.00),
('inventory-db-proxy',  'Inventory Partition Proxy',  'DATA',     'http://inventory-db-proxy:8084',  120, 150.00),
('notification-worker', 'Async Notification Dispatch','ASYNC',    'http://notification-worker:8085',  50, 500.00);

-- ============================================================================
-- Seed Data: Directed Topology Edges
-- ============================================================================

INSERT INTO service_edges (
    source_service_id,
    target_service_id,
    protocol,
    primary_weight_pct,
    canary_weight_pct,
    cold_replica_weight_pct,
    circuit_state
) VALUES
('api-gateway',     'auth-service',        'GRPC', 100.00, 0.00, 0.00, 'CLOSED'),
('api-gateway',     'order-processor',     'GRPC', 100.00, 0.00, 0.00, 'CLOSED'),
('order-processor', 'payment-ledger',      'GRPC', 100.00, 0.00, 0.00, 'CLOSED'),
('order-processor', 'inventory-db-proxy',  'GRPC', 100.00, 0.00, 0.00, 'CLOSED'),
('order-processor', 'notification-worker', 'GRPC', 100.00, 0.00, 0.00, 'CLOSED');

-- ============================================================================
-- Seed Data: Genesis Audit Record (Hash-Chained Block 0)
-- ============================================================================

INSERT INTO remediation_audit_ledger (
    event_id,
    timestamp_utc,
    service_id,
    action_type,
    trigger_source,
    cascade_probability,
    payload_json
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '2026-11-05 00:00:00.000000',
    'api-gateway',
    'NO_OP',
    'AUTONOMOUS_AI',
    0.0000,
    JSON_OBJECT(
        'block_index', 0,
        'description', 'Genesis audit block initialized for VektorMesh control plane',
        'architecture', 'polyglot-canary-mesh',
        'status', 'ACTIVE',
        'genesis_authority', 'VektorMesh Root Signer'
    )
);
