package com.coloranalysisbackend.service;

import com.coloranalysisbackend.model.Project;
import com.coloranalysisbackend.model.Task;
import com.coloranalysisbackend.repository.ProjectRepository;
import com.coloranalysisbackend.repository.TaskRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ProjectTaskExecutor {
    private static final List<String> BASE_OUTPUTS = List.of("mainColorCsv", "mainColorNumberCsv", "entropyCsv");

    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final PythonClientService pythonClientService;
    private final ObjectMapper objectMapper;
    private final Path storageBaseDir;
    private final Set<String> activeTaskIds = ConcurrentHashMap.newKeySet();

    public ProjectTaskExecutor(ProjectRepository projectRepository,
                               TaskRepository taskRepository,
                               PythonClientService pythonClientService,
                               ObjectMapper objectMapper,
                               @Value("${storage.base-dir}") String storageBaseDir) {
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.pythonClientService = pythonClientService;
        this.objectMapper = objectMapper;
        this.storageBaseDir = Paths.get(storageBaseDir).toAbsolutePath().normalize();
    }

    @Async("projectAnalysisExecutor")
    public void execute(String taskId) {
        if (!activeTaskIds.add(taskId)) return;
        Task task = taskRepository.findById(taskId).orElse(null);
        if (task == null) {
            activeTaskIds.remove(taskId);
            return;
        }
        Project project = projectRepository.findById(task.getProjectId()).orElse(null);
        if (project == null) {
            activeTaskIds.remove(taskId);
            return;
        }

        try {
            if (Boolean.TRUE.equals(task.getCancelRequested())) {
                finishCancelled(project, task, "cancelled before execution");
                return;
            }

            task.setStatus("running");
            task.setProgress(5);
            task.setCurrentStep("preparing");
            task.setStartedAt(LocalDateTime.now());
            taskRepository.save(task);
            project.setStatus("running");
            projectRepository.save(project);

            Path workspace = storageBaseDir.resolve("projects").resolve(project.getId()).resolve(task.getId());
            Path input = workspace.resolve("input");
            Files.createDirectories(input);

            Map<String, Object> params = readMap(task.getParams());
            Map<String, Object> analysisPlan = requireAnalysisPlan(params);
            stageImages(project, analysisPlan, input);
            Path analysisPlanFile = workspace.resolve("analysis-plan.json");
            objectMapper.writeValue(analysisPlanFile.toFile(), analysisPlan);

            task = refresh(taskId);
            if (Boolean.TRUE.equals(task.getCancelRequested())) {
                finishCancelled(project, task, "cancelled after preparation");
                return;
            }

            task.setProgress(20);
            task.setCurrentStep("pipeline");
            taskRepository.save(task);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("datasetDir", input.toString());
            payload.put("workspaceDir", workspace.toString());
            payload.put("cancelFile", workspace.resolve("cancel.requested").toString());
            payload.put("steps", ProjectAnalysisPlanService.PIPELINE_STEPS);
            payload.put("analysisPlanPath", analysisPlanFile.toString());

            Map<String, Object> result = pythonClientService.runPipeline(payload);
            task = refresh(taskId);
            result.put("imageManifest", buildImageManifest(analysisPlan));
            task.setResult(toJson(result));
            if (Boolean.TRUE.equals(task.getCancelRequested())) {
                finishCancelled(project, task, "cancelled while pipeline was running; diagnostic files retained");
                return;
            }

            validateOutputs(result);
            task.setStatus("success");
            task.setProgress(100);
            task.setCurrentStep("completed");
            task.setFinishedAt(LocalDateTime.now());
            task.setLogs("pipeline finished");
            taskRepository.save(task);
            project.setStatus("completed");
            projectRepository.save(project);
        } catch (Exception ex) {
            Task latest = taskRepository.findById(taskId).orElse(task);
            latest.setStatus("failed");
            latest.setFinishedAt(LocalDateTime.now());
            latest.setCurrentStep("failed");
            latest.setLogs(ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage());
            taskRepository.save(latest);
            project.setStatus("failed");
            projectRepository.save(project);
        } finally {
            activeTaskIds.remove(taskId);
        }
    }

    public boolean isActiveTask(String taskId) {
        return taskId != null && activeTaskIds.contains(taskId);
    }

    private void stageImages(Project project, Map<String, Object> analysisPlan,
                             Path input) throws Exception {
        Object rawImages = analysisPlan.get("images");
        if (!(rawImages instanceof List<?> images) || images.isEmpty()) {
            throw new IllegalStateException("task analysis plan contains no images");
        }
        for (Object rawImage : images) {
            if (!(rawImage instanceof Map<?, ?> imagePlan)) {
                throw new IllegalStateException("task analysis plan image entry is invalid");
            }
            String imageId = String.valueOf(imagePlan.get("imageId"));
            String fileName = String.valueOf(imagePlan.get("fileName"));
            Path source = storageBaseDir.resolve("projects").resolve(project.getId())
                    .resolve("draft").resolve("corrected").resolve(imageId + ".png").normalize();
            if (!Files.isRegularFile(source)) {
                throw new IllegalStateException("corrected image is missing: " + imageId);
            }
            Files.copy(source, input.resolve(fileName), StandardCopyOption.REPLACE_EXISTING);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> requireAnalysisPlan(Map<String, Object> params) {
        Object raw = params.get("analysisPlan");
        if (!(raw instanceof Map<?, ?>)) {
            throw new IllegalStateException("task analysis plan is missing");
        }
        return (Map<String, Object>) raw;
    }

    private List<Map<String, Object>> buildImageManifest(Map<String, Object> analysisPlan) {
        List<Map<String, Object>> manifest = new ArrayList<>();
        Object rawImages = analysisPlan.get("images");
        if (!(rawImages instanceof List<?> images)) return manifest;
        for (Object rawImage : images) {
            if (!(rawImage instanceof Map<?, ?> image)) continue;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("imageId", image.get("imageId"));
            item.put("datasetId", image.get("datasetId"));
            item.put("originalFileName", image.get("originalFileName"));
            item.put("fileName", image.get("fileName"));
            item.put("subjectCode", image.get("subjectCode"));
            item.put("capturedAt", image.get("capturedAt"));
            item.put("regions", image.get("regions"));
            manifest.add(item);
        }
        return manifest;
    }

    private void validateOutputs(Map<String, Object> result) {
        Object rawFiles = result == null ? null : result.get("files");
        if (!(rawFiles instanceof Map<?, ?> files)) throw new IllegalStateException("pipeline returned no files");
        for (String key : BASE_OUTPUTS) {
            Object value = files.get(key);
            if (!(value instanceof String path) || !Files.isRegularFile(Paths.get(path)) || fileSize(path) == 0) {
                throw new IllegalStateException("required output missing: " + key);
            }
        }
    }

    private long fileSize(String path) {
        try {
            return Files.size(Paths.get(path));
        } catch (Exception ex) {
            return 0;
        }
    }

    private void finishCancelled(Project project, Task task, String message) {
        task.setStatus("cancelled");
        task.setCurrentStep("cancelled");
        task.setFinishedAt(LocalDateTime.now());
        task.setLogs(message);
        taskRepository.save(task);
        project.setStatus("cancelled");
        projectRepository.save(project);
    }

    private Task refresh(String taskId) {
        return taskRepository.findById(taskId).orElseThrow();
    }

    private Map<String, Object> readMap(String json) {
        if (json == null || json.isBlank()) return new LinkedHashMap<>();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception ex) {
            return new LinkedHashMap<>();
        }
    }

    private String toJson(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }
}
