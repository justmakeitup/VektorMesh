-- ============================================================================
-- VektorMesh Cryptographic Audit Ledger Verification & Tamper Test Script
-- ============================================================================

USE vektormesh;

-- 1. Display current state of the ledger
SELECT 
    sequence_id,
    event_id,
    timestamp_utc,
    service_id,
    action_type,
    trigger_source,
    prev_hash,
    curr_hash
FROM remediation_audit_ledger
ORDER BY sequence_id ASC;

-- 2. Insert test remediation action to prove dynamic hash chaining
INSERT INTO remediation_audit_ledger (
    event_id,
    timestamp_utc,
    service_id,
    action_type,
    trigger_source,
    cascade_probability,
    payload_json
) VALUES (
    '11111111-2222-3333-4444-555555555555',
    '2026-11-05 00:01:00.123456',
    'order-processor',
    'THROTTLE_TRAFFIC',
    'AUTONOMOUS_AI',
    0.8750,
    JSON_OBJECT(
        'reason', 'High thread pool saturation detected',
        'p99_latency_ms', 312.45,
        'action_details', 'Applied 50% non-critical traffic throttling'
    )
);

-- 3. Verify that row 2 prev_hash matches row 1 curr_hash
SELECT 
    sequence_id,
    service_id,
    action_type,
    LEFT(prev_hash, 16) AS prev_hash_prefix,
    LEFT(curr_hash, 16) AS curr_hash_prefix,
    -- Validate mathematical equality of chain link
    CASE 
        WHEN sequence_id = 1 AND prev_hash = REPEAT('0', 64) THEN 'GENESIS_VALID'
        WHEN sequence_id > 1 AND prev_hash = (
            SELECT curr_hash 
            FROM remediation_audit_ledger l2 
            WHERE l2.sequence_id = remediation_audit_ledger.sequence_id - 1
        ) THEN 'CHAIN_LINK_VALID'
        ELSE 'CHAIN_BROKEN'
    END AS chain_verification_status
FROM remediation_audit_ledger
ORDER BY sequence_id ASC;

-- 4. Tamper Test A: Attempt to update an audit record (Expect SQLSTATE 45000)
-- UPDATE remediation_audit_ledger SET action_type = 'NO_OP' WHERE sequence_id = 1;

-- 5. Tamper Test B: Attempt to delete an audit record (Expect SQLSTATE 45000)
-- DELETE FROM remediation_audit_ledger WHERE sequence_id = 1;
