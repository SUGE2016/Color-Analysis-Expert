package com.coloranalysisbackend.service;

import com.coloranalysisbackend.model.Dataset;
import com.coloranalysisbackend.model.Project;
import com.coloranalysisbackend.model.Task;
import com.coloranalysisbackend.repository.DatasetRepository;
import com.coloranalysisbackend.repository.ProjectRepository;
import com.coloranalysisbackend.repository.TaskRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ProjectAnalysisService {
    private final ProjectRepository projectRepository;
    private final DatasetRepository datasetRepository;
    private final TaskRepository taskRepository;
    private final PythonClientService pythonClientService;
    private final ObjectMapper objectMapper;
    private final String storageBaseDir;

    public ProjectAnalysisService(ProjectRepository projectRepository,
                                  DatasetRepository datasetRepository,
                                  TaskRepository taskRepository,
                                  PythonClientService pythonClientService,
                                  ObjectMapper objectMapper,
                                  @Value("${storage.base-dir}") String storageBaseDir) {
        this.projectRepository = projectRepository;
        this.datasetRepository = datasetRepository;
        this.taskRepository = taskRepository;
        this.pythonClientService = pythonClientService;
        this.objectMapper = objectMapper;
        this.storageBaseDir = storageBaseDir;
    }

    public Project createProject(String name, String ownerId, String datasetId, String templateId, Map<String, Object> config) {
        if (datasetRepository.findById(datasetId).isEmpty()) {
            throw new IllegalArgumentException("dataset not found");
        }
        Project project = new Project();
        project.setId(UUID.randomUUID().toString());
        project.setName(name);
        project.setOwnerId(ownerId);
        project.setDatasetId(datasetId);
        project.setTemplateId(templateId);
        project.setConfig(toJson(config == null ? Map.of() : config));
        project.setStatus("created");
        return projectRepository.save(project);
    }

    public List<Project> listProjects() {
        return projectRepository.findAll();
    }

    public Project getProject(String projectId) {
        return projectRepository.findById(projectId).orElse(null);
    }

    public List<Task> listProjectTasks(String projectId) {
        return taskRepository.findByProjectId(projectId);
    }

    public Task runProject(String projectId,
                           List<String> steps,
                           String modelImagePath,
                           String butterflyJsonPath,
                           String edgeJsonPath,
                           String notes) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("project not found"));
        Dataset dataset = datasetRepository.findById(project.getDatasetId())
                .orElseThrow(() -> new IllegalArgumentException("dataset not found"));

        Task task = new Task();
        task.setId(UUID.randomUUID().toString());
        task.setProjectId(projectId);
        task.setTaskType("project-analysis");
        task.setStatus("pending");

        Map<String, Object> params = new HashMap<>();
        params.put("steps", steps);
        params.put("modelImagePath", modelImagePath);
        params.put("butterflyJsonPath", butterflyJsonPath);
        params.put("edgeJsonPath", edgeJsonPath);
        params.put("notes", notes);
        task.setParams(toJson(params));
        taskRepository.save(task);

        project.setStatus("running");
        projectRepository.save(project);

        try {
            Path datasetDir = Paths.get(storageBaseDir, dataset.getStoragePrefix()).toAbsolutePath();
            Path workspaceDir = Paths.get(storageBaseDir, "projects", projectId, task.getId()).toAbsolutePath();

            Map<String, Object> payload = new HashMap<>();
            payload.put("datasetDir", datasetDir.toString());
            payload.put("workspaceDir", workspaceDir.toString());
            payload.put("steps", steps == null || steps.isEmpty()
                    ? List.of("correction", "hsv", "entropy", "main_color", "main_color_number")
                    : steps);
            payload.put("modelImagePath", modelImagePath);
            payload.put("butterflyJsonPath", butterflyJsonPath);
            payload.put("edgeJsonPath", edgeJsonPath);

            Map<String, Object> result = pythonClientService.runPipeline(payload);
            task.setStatus("success");
            task.setResult(toJson(result));
            task.setLogs("pipeline finished");
            taskRepository.save(task);

            project.setStatus("completed");
            projectRepository.save(project);
            return task;
        } catch (Exception ex) {
            task.setStatus("failed");
            task.setLogs(ex.getMessage());
            taskRepository.save(task);

            project.setStatus("failed");
            projectRepository.save(project);
            return task;
        }
    }

    private String toJson(Object object) {
        try {
            return objectMapper.writeValueAsString(object);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("json serialize error: " + e.getMessage());
        }
    }

    /** 更新项目（name/config 均可选） */
    public Project updateProject(String projectId, String name, Map<String, Object> config) {
        Project p = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("project not found: " + projectId));
        if (name != null && !name.isBlank()) {
            p.setName(name);
        }
        if (config != null) {
            p.setConfig(toJson(config));
        }
        return projectRepository.save(p);
    }

    /** 删除项目及其所有任务记录 */
    public void deleteProject(String projectId) {
        projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("project not found: " + projectId));
        taskRepository.deleteAll(taskRepository.findByProjectId(projectId));
        projectRepository.deleteById(projectId);
    }
}
