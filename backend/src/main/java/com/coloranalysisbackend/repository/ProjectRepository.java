package com.coloranalysisbackend.repository;

import com.coloranalysisbackend.model.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectRepository extends JpaRepository<Project, String> {
    List<Project> findByOwnerId(String ownerId);
    Optional<Project> findByIdAndOwnerId(String id, String ownerId);
    boolean existsByOwnerIdAndName(String ownerId, String name);
    boolean existsByDatasetId(String datasetId);
    boolean existsByTemplateId(String templateId);
}
