package com.coloranalysisbackend.controller;

import com.coloranalysisbackend.model.Project;
import com.coloranalysisbackend.model.Task;
import com.coloranalysisbackend.service.ProjectAnalysisService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects")
@Tag(name = "项目分析", description = "项目草稿、异步分析与任务查询")
public class ProjectController {
    private final ProjectAnalysisService service;

    public ProjectController(ProjectAnalysisService service) {
        this.service = service;
    }

    @PostMapping
    @Operation(summary = "创建项目草稿")
    public ResponseEntity<Project> create(@RequestBody CreateProjectRequest req) {
        Project project = service.createProject(req.getName(), req.getDatasetIds(), req.getDatasetId(),
                req.getTemplateId(), req.getConfig());
        return ResponseEntity.ok(project);
    }

    @GetMapping
    @Operation(summary = "查询当前用户项目")
    public List<Project> list() {
        return service.listProjects();
    }

    @GetMapping("/{id}")
    public Project get(@PathVariable String id) {
        return service.getProject(id);
    }

    @PostMapping("/{id}/run")
    @Operation(summary = "异步执行项目分析")
    public ResponseEntity<Task> run(@PathVariable String id, @RequestBody(required = false) RunProjectRequest req) {
        rejectClientPaths(req);
        Task task = service.runProject(id, req == null ? null : req.getSteps());
        return ResponseEntity.accepted().location(URI.create("/api/tasks/" + task.getId())).body(task);
    }

    @PostMapping({"/{id}/stop", "/{id}/cancel"})
    public ResponseEntity<Task> stop(@PathVariable String id) {
        return ResponseEntity.accepted().body(service.stopProject(id));
    }

    @GetMapping("/{id}/tasks")
    public List<Task> listTasks(@PathVariable String id) {
        return service.listProjectTasks(id);
    }

    @PutMapping("/{id}")
    @Operation(summary = "持续保存项目草稿")
    public Project update(@PathVariable String id, @RequestBody UpdateProjectRequest req) {
        return service.updateProject(id, req.getName(), req.getDatasetIds(), req.getTemplateId(), req.getConfig());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.deleteProject(id);
        return ResponseEntity.noContent().build();
    }

    private void rejectClientPaths(RunProjectRequest req) {
        if (req != null && (req.getModelImagePath() != null || req.getButterflyJsonPath() != null || req.getEdgeJsonPath() != null)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "client supplied server paths are forbidden");
        }
    }

    @Data
    public static class CreateProjectRequest {
        private String name;
        private String ownerId; // ignored: owner always comes from JWT
        private String datasetId; // compatibility only
        private List<String> datasetIds;
        private String templateId;
        private Map<String, Object> config;
    }

    @Data
    public static class RunProjectRequest {
        private List<String> steps;
        private String modelImagePath;
        private String butterflyJsonPath;
        private String edgeJsonPath;
    }

    @Data
    public static class UpdateProjectRequest {
        private String name;
        private List<String> datasetIds;
        private String templateId;
        private Map<String, Object> config;
    }
}
