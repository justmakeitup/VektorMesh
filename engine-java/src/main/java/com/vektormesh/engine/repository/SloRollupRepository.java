package com.vektormesh.engine.repository;

import com.vektormesh.engine.domain.SloComplianceRollupEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SloRollupRepository extends JpaRepository<SloComplianceRollupEntity, Long> {
    List<SloComplianceRollupEntity> findTop60ByServiceIdOrderByWindowStartDesc(String serviceId);
}
