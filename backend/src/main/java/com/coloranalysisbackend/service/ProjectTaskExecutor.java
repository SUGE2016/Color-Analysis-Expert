package com.coloranalysisbackend.service;

import com.coloranalysisbackend.model.Image;
import com.coloranalysisbackend.model.Project;
import com.coloranalysisbackend.model.Task;
import com.coloranalysisbackend.repository.ImageRepository;
import com.coloranalysisbackend.repository.ProjectRepository;
import com.coloranalysisbackend.repository.TaskRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
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
    private static final List<String> BASE_STEPS = List.of("correction", "hsv", "entropy", "main_color", "main_color_number");
    private static final List<String> BASE_OUTPUTS = List.of("mainColorCsv", "mainColorNumberCsv", "entropyCsv");

    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final ImageRepository imageRepository;
    private final PythonClientService pythonClientService;
    private final ObjectMapper objectMapper;
    private final Path storageBaseDir;
    private final Set<String> activeTaskIds = ConcurrentHashMap.newKeySet();

    public ProjectTaskExecutor(ProjectRepository projectRepository,
                               TaskRepository taskRepository,
                               ImageRepository imageRepository,
                               PythonClientService pythonClientService,
                               ObjectMapper objectMapper,
                               @Value("${storage.base-dir}") String storageBaseDir) {
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.imageRepository = imageRepository;
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
            stageImages(project, input);

            Map<String, Object> params = readMap(task.getParams());
            List<String> steps = canonicalSteps(params.get("steps"), project.getConfig());
            boolean edgeEnabled = steps.contains("edge_color");
            Map<String, String> templateFiles = writeTemplateFiles(project, workspace, edgeEnabled);

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
            payload.put("steps", steps);
            payload.put("modelImagePath", templateFiles.get("model"));
            payload.put("butterflyJsonPath", templateFiles.get("regions"));
            if (edgeEnabled) payload.put("edgeJsonPath", templateFiles.get("edge"));

            Map<String, Object> result = pythonClientService.runPipeline(payload);
            task = refresh(taskId);
            task.setResult(toJson(result));
            if (Boolean.TRUE.equals(task.getCancelRequested())) {
                finishCancelled(project, task, "cancelled while pipeline was running; diagnostic files retained");
                return;
            }

            validateOutputs(result, edgeEnabled);
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

    private void stageImages(Project project, Path input) throws Exception {
        int count = 0;
        for (String datasetId : project.getDatasetIds()) {
            for (Image image : imageRepository.findByDatasetId(datasetId)) {
                if (image.getStorageKey() == null) continue;
                Path source = Paths.get(image.getStorageKey()).toAbsolutePath().normalize();
                if (!Files.isRegularFile(source)) continue;
                String original = image.getFileName() == null ? "image" : image.getFileName().replaceAll("[^a-zA-Z0-9._-]", "_");
                Files.copy(source, input.resolve(datasetId + "__" + image.getId() + "__" + original), StandardCopyOption.REPLACE_EXISTING);
                count++;
            }
        }
        if (count == 0) throw new IllegalStateException("selected datasets contain no readable images");
    }

    private Map<String, String> writeTemplateFiles(Project project, Path workspace, boolean edgeEnabled) throws Exception {
        JsonNode snapshot = objectMapper.readTree(project.getTemplateSnapshot());
        String imageKey = snapshot.path("templateImageKey").asText(null);
        if (imageKey == null) throw new IllegalStateException("template image is required");
        Path model = Paths.get(imageKey);
        if (!model.isAbsolute()) model = storageBaseDir.resolve(model);
        model = model.normalize();
        if (!Files.isRegularFile(model)) throw new IllegalStateException("template image is unavailable");

        JsonNode config = objectMapper.readTree(project.getConfig());
        JsonNode regions = config == null ? null : config.get("regions");
        if (regions == null || !regions.isArray() || regions.isEmpty()) {
            throw new IllegalStateException("project analysis regions are required");
        }
        JsonNode regionDocument = objectMapper.createObjectNode().set("regions", regions);
        Path regionsFile = workspace.resolve("template-regions.json");
        objectMapper.writeValue(regionsFile.toFile(), regionDocument);

        Map<String, String> files = new LinkedHashMap<>();
        files.put("model", model.toString());
        files.put("regions", regionsFile.toString());
        if (edgeEnabled) {
            Path edgeFile = workspace.resolve("template-edge-regions.json");
            objectMapper.writeValue(edgeFile.toFile(), regionDocument);
            files.put("edge", edgeFile.toString());
        }
        return files;
    }

    private List<String> canonicalSteps(Object requested, String configJson) {
        List<String> result = new ArrayList<>(BASE_STEPS);
        Map<String, Object> config = readMap(configJson);
        boolean edge = Boolean.TRUE.equals(config.get("edgeAnalysisEnabled"));
        if (requested instanceof List<?> list && (list.contains("edge_hsv") || list.contains("edge_color"))) edge = true;
        if (edge) result.addAll(List.of("edge_hsv", "edge_color"));
        return result;
    }

    @SuppressWarnings("unchecked")
    private void validateOutputs(Map<String, Object> result, boolean edgeEnabled) {
        Object rawFiles = result == null ? null : result.get("files");
        if (!(rawFiles instanceof Map<?, ?> files)) throw new IllegalStateException("pipeline returned no files");
        List<String> required = new ArrayList<>(BASE_OUTPUTS);
        if (edgeEnabled) required.add("edgeColorCsv");
        for (String key : required) {
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
