package com.vektormesh.engine.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "slo_compliance_rollups")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SloComplianceRollupEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "service_id", length = 64, nullable = false)
    private String serviceId;

    @Column(name = "window_start", nullable = false)
    private LocalDateTime windowStart;

    @Column(name = "avg_p99_ms", precision = 8, scale = 2, nullable = false)
    private BigDecimal avgP99Ms;

    @Column(name = "error_budget_burned_pct", precision = 5, scale = 2, nullable = false)
    private BigDecimal errorBudgetBurnedPct;

    @Column(name = "anomalies_detected", nullable = false)
    private Integer anomaliesDetected;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
