package com.vektormesh.engine.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "service_nodes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServiceNodeEntity {

    @Id
    @Column(name = "id", length = 64, nullable = false)
    private String id;

    @Column(name = "service_name", length = 128, nullable = false)
    private String serviceName;

    @Column(name = "tier", length = 32, nullable = false)
    private String tier;

    @Column(name = "base_url", length = 255, nullable = false)
    private String baseUrl;

    @Column(name = "max_thread_pool", nullable = false)
    private Integer maxThreadPool;

    @Column(name = "slo_p99_ms", precision = 8, scale = 2, nullable = false)
    private BigDecimal sloP99Ms;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}
