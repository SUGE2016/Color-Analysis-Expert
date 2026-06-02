package com.coloranalysisbackend.controller;

import com.coloranalysisbackend.model.DatasetGroup;
import com.coloranalysisbackend.service.DatasetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/dataset-groups")
@Tag(name = "数据集分组", description = "数据集分组管理")
public class DatasetGroupController {
    private final DatasetService datasetService;

    public DatasetGroupController(DatasetService datasetService) {
        this.datasetService = datasetService;
    }

    @PostMapping
    @Operation(summary = "创建分组")
    public ResponseEntity<?> create(@RequestBody CreateGroupRequest req) {
        try {
            DatasetGroup group = datasetService.createGroup(req.getName(), req.getDescription());
            return ResponseEntity.ok(group);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @GetMapping
    @Operation(summary = "查询分组列表")
    public ResponseEntity<List<DatasetGroup>> list() {
        return ResponseEntity.ok(datasetService.listGroups());
    }

    @GetMapping("/{id}")
    @Operation(summary = "查询分组详情")
    public ResponseEntity<DatasetGroup> get(@PathVariable("id") String id) {
        DatasetGroup group = datasetService.getGroup(id);
        if (group == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(group);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新分组（name/description 均可选）")
    public ResponseEntity<?> update(@PathVariable("id") String id,
                                    @RequestBody CreateGroupRequest req) {
        try {
            DatasetGroup group = datasetService.updateGroup(id, req.getName(), req.getDescription());
            return ResponseEntity.ok(group);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除分组（有数据集属于该分组时拒绝）")
    public ResponseEntity<?> delete(@PathVariable("id") String id) {
        try {
            datasetService.deleteGroup(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(409).body(ex.getMessage());
        }
    }

    public static class CreateGroupRequest {
        private String name;
        private String description;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
    }
}
