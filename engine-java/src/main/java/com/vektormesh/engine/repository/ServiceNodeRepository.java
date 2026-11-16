package com.vektormesh.engine.repository;

import com.vektormesh.engine.domain.ServiceNodeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ServiceNodeRepository extends JpaRepository<ServiceNodeEntity, String> {
    List<ServiceNodeEntity> findByTier(String tier);
}
