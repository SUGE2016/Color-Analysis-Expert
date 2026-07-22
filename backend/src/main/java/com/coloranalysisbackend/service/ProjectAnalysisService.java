package com.coloranalysisbackend.service;

import com.coloranalysisbackend.model.Dataset;
import com.coloranalysisbackend.model.Project;
import com.coloranalysisbackend.model.Task;
import com.coloranalysisbackend.model.Template;
import com.coloranalysisbackend.repository.DatasetRepository;
import com.coloranalysisbackend.repository.ImageRepository;
import com.coloranalysisbackend.repository.ProjectRepository;
import com.coloranalysisbackend.repository.TaskRepository;
import com.coloranalysisbackend.repository.TemplateRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class ProjectAnalysisService {
    private final ProjectRepository projectRepository;
    private final DatasetRepository datasetRepository;
    private final ImageRepository imageRepository;
    private final TemplateRepository templateRepository;
    private final TaskRepository taskRepository;
    private final ProjectTaskExecutor taskExecutor;
    private final ObjectMapper objectMapper;
    private final CurrentUserService currentUserService;
    private final Path storageBaseDir;

    public ProjectAnalysisService(ProjectRepository projectRepository,
                                  DatasetRepository datasetRepository,
                                  ImageRepository imageRepository,
                                  TemplateRepository templateRepository,
                                  TaskRepository taskRepository,
                                  ProjectTaskExecutor taskExecutor,
                                  ObjectMapper objectMapper,
                                  CurrentUserService currentUserService,
                                  @Value("${storage.base-dir}") String storageBaseDir) {
        this.projectRepository = projectRepository;
        this.datasetRepository = datasetRepository;
        this.imageRepository = imageRepository;
        this.templateRepository = templateRepository;
        this.taskRepository = taskRepository;
        this.taskExecutor = taskExecutor;
        this.objectMapper = objectMapper;
        this.currentUserService = currentUserService;
        this.storageBaseDir = Paths.get(storageBaseDir).toAbsolutePath().normalize();
    }

    @Transactional
    public Project createProject(String name, List<String> datasetIds, String legacyDatasetId,
                                 String templateId, Map<String, Object> config) {
        String ownerId = currentUserService.requireCurrentUserId();
        if (name == null || name.isBlank()) unprocessable("project name is required");
        if (projectRepository.existsByOwnerIdAndName(ownerId, name.trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "project name already exists");
        }
        Set<String> ids = normalizeDatasetIds(datasetIds, legacyDatasetId);
        if (ids.isEmpty()) unprocessable("at least one datasetId is required");
        validateDatasets(ids, ownerId);
        Template template = requireTemplate(templateId);

        Project project = new Project();
        project.setId(UUID.randomUUID().toString());
        project.setName(name.trim());
        project.setOwnerId(ownerId);
        project.setDatasetIds(ids);
        project.setDatasetId(ids.iterator().next());
        project.setTemplateId(templateId);
        project.setTemplateSnapshot(snapshotTemplate(template));
        project.setConfig(toJson(config == null ? Map.of() : config));
        project.setStatus("draft");
        return projectRepository.save(project);
    }

    public List<Project> listProjects() {
        return projectRepository.findByOwnerId(currentUserService.requireCurrentUserId());
    }

    public Project getProject(String projectId) {
        return requireOwnedProject(projectId);
    }

    public List<Task> listProjectTasks(String projectId) {
        requireOwnedProject(projectId);
        return taskRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
    }

    @Transactional
    public Task runProject(String projectId, List<String> steps) {
        Project project = requireOwnedProject(projectId);
        if (project.getTemplateId() == null || project.getTemplateId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "template is required before running");
        }
        if (project.getDatasetIds() == null || project.getDatasetIds().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "datasets are required before running");
        }
        validateProjectRegions(project.getConfig());
        long imageCount = project.getDatasetIds().stream().mapToLong(imageRepository::countByDatasetId).sum();
        if (imageCount == 0) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "selected datasets contain no images");
        }
        boolean active = taskRepository.findByProjectId(projectId).stream()
                .anyMatch(t -> "queued".equals(t.getStatus()) || "running".equals(t.getStatus()));
        if (active) throw new ResponseStatusException(HttpStatus.CONFLICT, "project already has an active task");

        Task task = new Task();
        task.setId(UUID.randomUUID().toString());
        task.setProjectId(projectId);
        task.setTaskType("project-analysis");
        task.setStatus("queued");
        task.setProgress(0);
        task.setCurrentStep("queued");
        task.setCancelRequested(false);
        task.setParams(toJson(Map.of("steps", steps == null ? List.of() : steps)));
        taskRepository.save(task);
        project.setStatus("queued");
        projectRepository.save(project);
        String taskId = task.getId();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                taskExecutor.execute(taskId);
            }
        });
        return task;
    }

    @Transactional
    public Task stopProject(String projectId) {
        Project project = requireOwnedProject(projectId);
        Task task = taskRepository.findTopByProjectIdOrderByCreatedAtDesc(projectId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "project has no task to cancel"));
        if (!List.of("queued", "running").contains(task.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "task is not cancellable in status " + task.getStatus());
        }
        task.setCancelRequested(true);
        try {
            Path marker = storageBaseDir.resolve("projects").resolve(projectId).resolve(task.getId()).resolve("cancel.requested");
            Files.createDirectories(marker.getParent());
            Files.writeString(marker, "cancelled");
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "failed to persist cancellation marker");
        }
        boolean orphanedRunningTask = "running".equals(task.getStatus()) && !taskExecutor.isActiveTask(task.getId());
        if ("queued".equals(task.getStatus()) || orphanedRunningTask) {
            task.setStatus("cancelled");
            task.setCurrentStep("cancelled");
            task.setFinishedAt(LocalDateTime.now());
            task.setLogs(orphanedRunningTask
                    ? "cancelled orphaned running task; no executor is active in this API instance"
                    : "cancelled before execution");
            project.setStatus("cancelled");
            projectRepository.save(project);
        }
        taskRepository.save(task);
        return task;
    }

    @Transactional
    public Project updateProject(String projectId, String name, List<String> datasetIds,
                                 String templateId, Map<String, Object> config) {
        Project project = requireOwnedProject(projectId);
        if (List.of("queued", "running").contains(project.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "running project cannot be edited");
        }
        if (name != null && !name.isBlank() && !name.trim().equals(project.getName())) {
            if (projectRepository.existsByOwnerIdAndName(project.getOwnerId(), name.trim())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "project name already exists");
            }
            project.setName(name.trim());
        }
        if (datasetIds != null) {
            Set<String> ids = normalizeDatasetIds(datasetIds, null);
            if (ids.isEmpty()) unprocessable("at least one datasetId is required");
            validateDatasets(ids, project.getOwnerId());
            project.setDatasetIds(ids);
            project.setDatasetId(ids.iterator().next());
        }
        if (templateId != null) {
            Template template = requireTemplate(templateId);
            project.setTemplateId(templateId);
            project.setTemplateSnapshot(snapshotTemplate(template));
        }
        if (config != null) project.setConfig(toJson(config));
        project.setStatus("draft");
        return projectRepository.save(project);
    }

    @Transactional
    public void deleteProject(String projectId) {
        Project project = requireOwnedProject(projectId);
        if (List.of("queued", "running").contains(project.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "cancel the active task before deleting project");
        }
        taskRepository.deleteAll(taskRepository.findByProjectId(projectId));
        projectRepository.delete(project);
    }

    public Task getOwnedTask(String taskId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "task not found"));
        requireOwnedProject(task.getProjectId());
        return task;
    }

    private Project requireOwnedProject(String projectId) {
        String ownerId = currentUserService.requireCurrentUserId();
        if (projectRepository.findById(projectId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "project not found");
        }
        return projectRepository.findByIdAndOwnerId(projectId, ownerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "project belongs to another user"));
    }

    private Set<String> normalizeDatasetIds(List<String> datasetIds, String legacyDatasetId) {
        Set<String> ids = new LinkedHashSet<>();
        if (datasetIds != null) datasetIds.stream().filter(id -> id != null && !id.isBlank()).forEach(ids::add);
        if (ids.isEmpty() && legacyDatasetId != null && !legacyDatasetId.isBlank()) ids.add(legacyDatasetId);
        return ids;
    }

    private void validateDatasets(Set<String> ids, String ownerId) {
        for (String id : ids) {
            Dataset dataset = datasetRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "dataset not found: " + id));
            if (dataset.getOwnerId() != null && !dataset.getOwnerId().equals(ownerId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "dataset belongs to another user: " + id);
            }
        }
    }

    private Template requireTemplate(String templateId) {
        if (templateId == null || templateId.isBlank()) unprocessable("templateId is required");
        Template template = templateRepository.findById(templateId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "template not found"));
        if (template.getTemplateImageKey() == null || template.getTemplateImageKey().isBlank()) {
            unprocessable("template image is required");
        }
        Path imagePath = Paths.get(template.getTemplateImageKey());
        if (!imagePath.isAbsolute()) imagePath = storageBaseDir.resolve(imagePath);
        if (!Files.isRegularFile(imagePath.normalize())) {
            unprocessable("template image is unavailable");
        }
        return template;
    }

    private String snapshotTemplate(Template template) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("id", template.getId());
        snapshot.put("name", template.getName());
        snapshot.put("templateImageKey", template.getTemplateImageKey());
        return toJson(snapshot);
    }

    private void validateProjectRegions(String configJson) {
        try {
            Map<?, ?> config = objectMapper.readValue(configJson == null ? "{}" : configJson, Map.class);
            Object rawRegions = config.get("regions");
            if (!(rawRegions instanceof List<?>)) {
                unprocessable("请先在步骤 3 定义至少一个分析区域");
            }
            List<?> regions = (List<?>) rawRegions;
            if (regions.isEmpty()) {
                unprocessable("请先在步骤 3 定义至少一个分析区域");
            }
            for (Object rawRegion : regions) {
                if (!(rawRegion instanceof Map<?, ?> region)
                        || !(region.get("regionId") instanceof String regionId)
                        || regionId.isBlank()
                        || !(region.get("polygon") instanceof List<?> polygon)
                        || polygon.size() < 3
                        || polygon.stream().anyMatch(point -> !(point instanceof Map<?, ?> coordinates)
                                || !(coordinates.get("x") instanceof Number)
                                || !(coordinates.get("y") instanceof Number))) {
                    unprocessable("步骤 3 的分析区域格式无效");
                }
            }
        } catch (JsonProcessingException ex) {
            unprocessable("项目配置格式无效");
        }
    }

    private String toJson(Object object) {
        try {
            return objectMapper.writeValueAsString(object);
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "json serialize error");
        }
    }

    private void badRequest(String message) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private void unprocessable(String message) {
        throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message);
    }
}
