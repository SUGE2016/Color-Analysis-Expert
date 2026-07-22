package com.coloranalysisbackend.service;

import com.coloranalysisbackend.model.Project;
import com.coloranalysisbackend.model.Task;
import com.coloranalysisbackend.repository.ProjectRepository;
import com.coloranalysisbackend.repository.TaskRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Component
public class ProjectTaskRecovery implements ApplicationRunner {
    private static final List<String> ACTIVE_STATUSES = List.of("queued", "running");

    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;

    public ProjectTaskRecovery(TaskRepository taskRepository, ProjectRepository projectRepository) {
        this.taskRepository = taskRepository;
        this.projectRepository = projectRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        for (Task task : taskRepository.findByStatusIn(ACTIVE_STATUSES)) {
            boolean cancellationRequested = Boolean.TRUE.equals(task.getCancelRequested());
            task.setStatus(cancellationRequested ? "cancelled" : "failed");
            task.setCurrentStep(cancellationRequested ? "cancelled" : "failed");
            task.setFinishedAt(LocalDateTime.now());
            task.setLogs(cancellationRequested
                    ? "recovered as cancelled after API restart"
                    : "failed because API restarted while task was active");
            taskRepository.save(task);

            Project project = projectRepository.findById(task.getProjectId()).orElse(null);
            if (project != null && ACTIVE_STATUSES.contains(project.getStatus())) {
                project.setStatus(cancellationRequested ? "cancelled" : "failed");
                projectRepository.save(project);
            }
        }
    }
}
