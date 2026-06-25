package com.coloranalysisbackend.repository;

import com.coloranalysisbackend.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskRepository extends JpaRepository<Task, String> {
    List<Task> findByProjectId(String projectId);

    Optional<Task> findTopByProjectIdAndStatusOrderByCreatedAtDesc(String projectId, String status);
}
