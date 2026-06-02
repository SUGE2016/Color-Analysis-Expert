package com.coloranalysisbackend.controller;

import com.coloranalysisbackend.model.Project;
import com.coloranalysisbackend.model.Task;
import com.coloranalysisbackend.service.ProjectAnalysisService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects")
@Tag(name = "项目分析", description = "分析项目创建、执行与任务查询")
public class ProjectController {
    private final ProjectAnalysisService projectAnalysisService;

    public ProjectController(ProjectAnalysisService projectAnalysisService) {
        this.projectAnalysisService = projectAnalysisService;
    }

    @PostMapping
    @Operation(summary = "创建分析项目")
    public ResponseEntity<?> create(@RequestBody CreateProjectRequest req) {
        try {
            Project p = projectAnalysisService.createProject(
                    req.getName(),
                    req.getOwnerId(),
                    req.getDatasetId(),
                    req.getTemplateId(),
                    req.getConfig()
            );
            return ResponseEntity.ok(p);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @GetMapping
    @Operation(summary = "查询项目列表")
    public ResponseEntity<List<Project>> list() {
        return ResponseEntity.ok(projectAnalysisService.listProjects());
    }

    @GetMapping("/{id}")
    @Operation(summary = "查询项目详情")
    public ResponseEntity<Project> get(@PathVariable("id") String id) {
        Project p = projectAnalysisService.getProject(id);
        if (p == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(p);
    }

    @PostMapping("/{id}/run")
    @Operation(summary = "执行项目分析")
    public ResponseEntity<?> run(@PathVariable("id") String id, @RequestBody RunProjectRequest req) {
        try {
            Task task = projectAnalysisService.runProject(
                    id,
                    req.getSteps(),
                    req.getModelImagePath(),
                    req.getButterflyJsonPath(),
                    req.getEdgeJsonPath(),
                    req.getNotes()
            );
            return ResponseEntity.ok(task);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @GetMapping("/{id}/tasks")
    @Operation(summary = "查询项目任务列表")
    public ResponseEntity<List<Task>> listTasks(@PathVariable("id") String id) {
        return ResponseEntity.ok(projectAnalysisService.listProjectTasks(id));
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新项目（name/config 均可选）")
    public ResponseEntity<?> update(@PathVariable("id") String id,
                                    @RequestBody UpdateProjectRequest req) {
        try {
            Project p = projectAnalysisService.updateProject(id, req.getName(), req.getConfig());
            return ResponseEntity.ok(p);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除项目及其所有任务")
    public ResponseEntity<?> delete(@PathVariable("id") String id) {
        try {
            projectAnalysisService.deleteProject(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @Data
    public static class CreateProjectRequest {
        private String name;
        private String ownerId;
        private String datasetId;
        private String templateId;
        private Map<String, Object> config;
    }

    @Data
    public static class RunProjectRequest {
        private List<String> steps;
        private String modelImagePath;
        private String butterflyJsonPath;
        private String edgeJsonPath;
        private String notes;
    }

    @Data
    public static class UpdateProjectRequest {
        private String name;
        private Map<String, Object> config;
    }
}
