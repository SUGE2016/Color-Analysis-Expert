package com.coloranalysisbackend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;

@Component
public class ProjectDraftStorage {
    private final Path projectsRoot;

    public ProjectDraftStorage(@Value("${storage.base-dir}") String storageBaseDir) {
        this.projectsRoot = Paths.get(storageBaseDir).toAbsolutePath().normalize().resolve("projects");
    }

    public Path projectRoot(String projectId) {
        return projectsRoot.resolve(projectId).normalize();
    }

    public Path correctedDirectory(String projectId) {
        return projectRoot(projectId).resolve("draft").resolve("corrected");
    }

    public Path correctedImage(String projectId, String imageId) {
        return correctedDirectory(projectId).resolve(imageId + ".png").normalize();
    }

    public void clearDraft(String projectId) {
        deleteTree(projectRoot(projectId).resolve("draft"));
    }

    public void clearProject(String projectId) {
        deleteTree(projectRoot(projectId));
    }

    private void deleteTree(Path target) {
        Path normalized = target.toAbsolutePath().normalize();
        if (!normalized.startsWith(projectsRoot) || normalized.equals(projectsRoot) || !Files.exists(normalized)) {
            return;
        }
        try (var paths = Files.walk(normalized)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ex) {
                    throw new IllegalStateException("failed to delete project workspace: " + path, ex);
                }
            });
        } catch (IOException ex) {
            throw new IllegalStateException("failed to inspect project workspace: " + normalized, ex);
        }
    }
}
