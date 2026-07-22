package com.coloranalysisbackend.repository;

import com.coloranalysisbackend.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.Collection;

@Repository
public interface TaskRepository extends JpaRepository<Task, String> {
    List<Task> findByProjectId(String projectId);

    List<Task> findByProjectIdOrderByCreatedAtDesc(String projectId);

    Optional<Task> findTopByProjectIdAndStatusOrderByCreatedAtDesc(String projectId, String status);

    Optional<Task> findTopByProjectIdOrderByCreatedAtDesc(String projectId);

    List<Task> findByStatusIn(Collection<String> statuses);
}
