package com.coloranalysisbackend.service;

import com.coloranalysisbackend.model.Image;
import com.coloranalysisbackend.model.Project;
import com.coloranalysisbackend.repository.ImageRepository;
import com.coloranalysisbackend.repository.ProjectRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ProjectCorrectionService {
    private final ProjectRepository projectRepository;
    private final ImageRepository imageRepository;
    private final CurrentUserService currentUserService;
    private final PythonClientService pythonClientService;
    private final ProjectDraftStorage draftStorage;
    private final ObjectMapper objectMapper;
    private final Path storageBaseDir;

    public ProjectCorrectionService(ProjectRepository projectRepository,
                                    ImageRepository imageRepository,
                                    CurrentUserService currentUserService,
                                    PythonClientService pythonClientService,
                                    ProjectDraftStorage draftStorage,
                                    ObjectMapper objectMapper,
                                    @Value("${storage.base-dir}") String storageBaseDir) {
        this.projectRepository = projectRepository;
        this.imageRepository = imageRepository;
        this.currentUserService = currentUserService;
        this.pythonClientService = pythonClientService;
        this.draftStorage = draftStorage;
        this.objectMapper = objectMapper;
        this.storageBaseDir = Paths.get(storageBaseDir).toAbsolutePath().normalize();
    }

    public byte[] correct(String projectId, String imageId) {
        Project project = requireOwnedProject(projectId);
        Image image = requireProjectImage(project, imageId);
        Path source = readablePath(image.getStorageKey(), "source image is unavailable");
        Path template = templatePath(project);
        try {
            byte[] corrected = pythonClientService.alignImage(Files.readAllBytes(template), Files.readAllBytes(source));
            if (corrected == null || corrected.length == 0) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "correction returned an empty image");
            }
            Path destination = draftStorage.correctedImage(projectId, imageId);
            Files.createDirectories(destination.getParent());
            Path temporary = destination.resolveSibling(destination.getFileName() + ".tmp");
            Files.write(temporary, corrected);
            try {
                Files.move(temporary, destination, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException ex) {
                Files.move(temporary, destination, StandardCopyOption.REPLACE_EXISTING);
            }
            return corrected;
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "image correction failed: " + safeMessage(ex));
        }
    }

    public List<Map<String, Object>> list(String projectId) {
        Project project = requireOwnedProject(projectId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (String datasetId : project.getDatasetIds()) {
            for (Image image : imageRepository.findByDatasetId(datasetId)) {
                Path corrected = draftStorage.correctedImage(projectId, image.getId());
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("imageId", image.getId());
                item.put("datasetId", datasetId);
                item.put("fileName", image.getFileName());
                item.put("status", Files.isRegularFile(corrected) ? "completed" : "pending");
                item.put("previewUrl", Files.isRegularFile(corrected)
                        ? "/api/projects/" + projectId + "/corrections/" + image.getId() + "/file"
                        : null);
                result.add(item);
            }
        }
        return result;
    }

    public byte[] read(String projectId, String imageId) {
        Project project = requireOwnedProject(projectId);
        requireProjectImage(project, imageId);
        Path path = draftStorage.correctedImage(projectId, imageId);
        if (!Files.isRegularFile(path)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "corrected image not found");
        }
        try {
            return Files.readAllBytes(path);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "failed to read corrected image");
        }
    }

    private Project requireOwnedProject(String projectId) {
        String ownerId = currentUserService.requireCurrentUserId();
        if (projectRepository.findById(projectId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "project not found");
        }
        return projectRepository.findByIdAndOwnerId(projectId, ownerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "project belongs to another user"));
    }

    private Image requireProjectImage(Project project, String imageId) {
        Image image = imageRepository.findById(imageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "image not found"));
        if (project.getDatasetIds() == null || !project.getDatasetIds().contains(image.getDatasetId())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "image does not belong to a selected project dataset");
        }
        return image;
    }

    private Path templatePath(Project project) {
        try {
            JsonNode snapshot = objectMapper.readTree(project.getTemplateSnapshot());
            return readablePath(snapshot.path("templateImageKey").asText(null), "template image is unavailable");
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "template snapshot is invalid");
        }
    }

    private Path readablePath(String raw, String message) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message);
        }
        Path path = Paths.get(raw);
        if (!path.isAbsolute()) path = storageBaseDir.resolve(path);
        path = path.toAbsolutePath().normalize();
        if (!Files.isRegularFile(path) || !Files.isReadable(path)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message);
        }
        return path;
    }

    private String safeMessage(Exception ex) {
        return ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage();
    }
}
