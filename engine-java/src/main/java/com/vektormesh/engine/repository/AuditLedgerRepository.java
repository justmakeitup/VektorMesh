package com.vektormesh.engine.repository;

import com.vektormesh.engine.domain.AuditLedgerEntry;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

/**
 * Audit Ledger Repository backed by JdbcTemplate to respect MySQL engine triggers.
 * Bypasses JPA dirty checking and avoids attempting updates on immutable audit records.
 */
@Repository
public class AuditLedgerRepository {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<AuditLedgerEntry> ROW_MAPPER = (rs, rowNum) -> AuditLedgerEntry.builder()
            .sequenceId(rs.getLong("sequence_id"))
            .eventId(rs.getString("event_id"))
            .timestampUtc(rs.getTimestamp("timestamp_utc").toLocalDateTime())
            .serviceId(rs.getString("service_id"))
            .actionType(rs.getString("action_type"))
            .triggerSource(rs.getString("trigger_source"))
            .cascadeProbability(rs.getBigDecimal("cascade_probability"))
            .payloadJson(rs.getString("payload_json"))
            .prevHash(rs.getString("prev_hash"))
            .currHash(rs.getString("curr_hash"))
            .build();

    public AuditLedgerRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Inserts an audit ledger entry.
     * Computes deterministic SHA-256 hash chain in Java as fallback
     * (or allows the MySQL BEFORE INSERT trigger to overwrite it).
     */
    public void recordRemediationEvent(
            String serviceId,
            String actionType,
            String triggerSource,
            BigDecimal cascadeProbability,
            String payloadJson
    ) {
        String eventId = UUID.randomUUID().toString();
        LocalDateTime nowUtc = LocalDateTime.now(ZoneOffset.UTC);

        String prevHash = "0".repeat(64);
        try {
            var latest = jdbcTemplate.query(
                    "SELECT curr_hash FROM remediation_audit_ledger ORDER BY sequence_id DESC LIMIT 1",
                    (rs, rowNum) -> rs.getString("curr_hash")
            );
            if (!latest.isEmpty() && latest.get(0) != null && !latest.get(0).isBlank()) {
                prevHash = latest.get(0);
            }
        } catch (Exception ignored) {}

        String probStr = cascadeProbability != null ? cascadeProbability.setScale(4, java.math.RoundingMode.HALF_UP).toString() : "0.0000";
        String raw = String.join("|",
                prevHash,
                eventId,
                nowUtc.toString(),
                serviceId,
                actionType,
                triggerSource,
                probStr,
                payloadJson != null ? payloadJson : "{}"
        );
        String currHash = computeSha256(raw);

        String sql = """
            INSERT INTO remediation_audit_ledger (
                event_id,
                timestamp_utc,
                service_id,
                action_type,
                trigger_source,
                cascade_probability,
                payload_json,
                prev_hash,
                curr_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;

        jdbcTemplate.update(
                sql,
                eventId,
                Timestamp.valueOf(nowUtc),
                serviceId,
                actionType,
                triggerSource,
                cascadeProbability != null ? cascadeProbability : BigDecimal.ZERO,
                payloadJson != null ? payloadJson : "{}",
                prevHash,
                currHash
        );
    }

    private static String computeSha256(String input) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] encodedhash = digest.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : encodedhash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString().toLowerCase();
        } catch (Exception e) {
            return "0".repeat(64);
        }
    }

    public List<AuditLedgerEntry> findLatest100() {
        String sql = "SELECT * FROM remediation_audit_ledger ORDER BY sequence_id DESC LIMIT 100";
        return jdbcTemplate.query(sql, ROW_MAPPER);
    }

    public List<AuditLedgerEntry> findAllOrderedBySequence() {
        String sql = "SELECT * FROM remediation_audit_ledger ORDER BY sequence_id ASC";
        return jdbcTemplate.query(sql, ROW_MAPPER);
    }

    public long count() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM remediation_audit_ledger", Long.class);
        return count != null ? count : 0L;
    }
}
