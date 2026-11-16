package com.vektormesh.engine.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "remediation_audit_ledger")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLedgerEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "sequence_id")
    private Long sequenceId;

    @Column(name = "event_id", length = 36, nullable = false)
    private String eventId;

    @Column(name = "timestamp_utc", nullable = false)
    private LocalDateTime timestampUtc;

    @Column(name = "service_id", length = 64, nullable = false)
    private String serviceId;

    @Column(name = "action_type", length = 64, nullable = false)
    private String actionType;

    @Column(name = "trigger_source", length = 32, nullable = false)
    private String triggerSource;

    @Column(name = "cascade_probability", precision = 5, scale = 4, nullable = false)
    private BigDecimal cascadeProbability;

    @Column(name = "payload_json", columnDefinition = "json", nullable = false)
    private String payloadJson;

    @Column(name = "prev_hash", length = 64, nullable = false)
    private String prevHash;

    @Column(name = "curr_hash", length = 64, nullable = false, unique = true)
    private String currHash;
}
