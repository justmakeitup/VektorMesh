package com.vektormesh.engine.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "service_edges")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServiceEdgeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "source_service_id", length = 64, nullable = false)
    private String sourceServiceId;

    @Column(name = "target_service_id", length = 64, nullable = false)
    private String targetServiceId;

    @Column(name = "protocol", length = 32, nullable = false)
    private String protocol;

    @Column(name = "primary_weight_pct", precision = 5, scale = 2, nullable = false)
    private BigDecimal primaryWeightPct;

    @Column(name = "canary_weight_pct", precision = 5, scale = 2, nullable = false)
    private BigDecimal canaryWeightPct;

    @Column(name = "cold_replica_weight_pct", precision = 5, scale = 2, nullable = false)
    private BigDecimal coldReplicaWeightPct;

    @Column(name = "circuit_state", length = 16, nullable = false)
    private String circuitState;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}
