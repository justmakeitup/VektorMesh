package com.vektormesh.engine.repository;

import com.vektormesh.engine.domain.ServiceEdgeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ServiceEdgeRepository extends JpaRepository<ServiceEdgeEntity, Long> {
    List<ServiceEdgeEntity> findBySourceServiceId(String sourceServiceId);
    List<ServiceEdgeEntity> findByTargetServiceId(String targetServiceId);
    Optional<ServiceEdgeEntity> findBySourceServiceIdAndTargetServiceId(String sourceServiceId, String targetServiceId);
}
