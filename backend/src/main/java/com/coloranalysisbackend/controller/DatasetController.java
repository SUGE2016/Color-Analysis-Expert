package com.coloranalysisbackend.controller;

import com.coloranalysisbackend.model.Dataset;
import com.coloranalysisbackend.model.Image;
import com.coloranalysisbackend.service.DatasetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/datasets")
@Tag(name = "数据集管理", description = "数据集与样本图片管理")
public class DatasetController {
    private final DatasetService datasetService;

    public DatasetController(DatasetService datasetService) {
        this.datasetService = datasetService;
    }

    @PostMapping
    @Operation(summary = "创建数据集")
    public ResponseEntity<?> createDataset(@RequestBody CreateRequest req) {
        try {
            Dataset ds = datasetService.createDataset(
                    req.getName(),
                    req.getDescription(),
                    req.getOwnerId(),
                    req.getScene(),
                    req.getGroupId()
            );
            return ResponseEntity.ok(ds);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @GetMapping
    @Operation(summary = "查询数据集列表")
    public ResponseEntity<?> list(@RequestParam(value = "groupId", required = false) String groupId,
                                  @RequestParam(value = "scene", required = false) String scene) {
        try {
            return ResponseEntity.ok(datasetService.listDatasets(groupId, scene));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @GetMapping("/{id}")
    @Operation(summary = "查询数据集详情")
    public ResponseEntity<Dataset> get(@PathVariable("id") String id) {
        Dataset ds = datasetService.getDataset(id);
        if (ds == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(ds);
    }

    @PostMapping(value = "/{id}/images/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "上传数据集图片")
    public ResponseEntity<Image> uploadImage(@PathVariable("id") String id,
                                             @RequestParam("file") MultipartFile file) throws IOException {
        Image img = datasetService.storeImage(id, file);
        return ResponseEntity.ok(img);
    }

    @GetMapping("/{id}/images")
    @Operation(summary = "查询数据集图片列表")
    public ResponseEntity<List<Image>> listImages(@PathVariable("id") String id) {
        return ResponseEntity.ok(datasetService.listImages(id));
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新数据集（name/description/scene/groupId 均可选）")
    public ResponseEntity<?> update(@PathVariable("id") String id,
                                    @RequestBody CreateRequest req) {
        try {
            Dataset ds = datasetService.updateDataset(id, req.getName(), req.getDescription(),
                    req.getScene(), req.getGroupId());
            return ResponseEntity.ok(ds);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除数据集（有项目引用时拒绝）")
    public ResponseEntity<?> delete(@PathVariable("id") String id) {
        try {
            datasetService.deleteDataset(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(409).body(ex.getMessage());
        }
    }

    @DeleteMapping("/{id}/images/{imageId}")
    @Operation(summary = "删除数据集内单张图片")
    public ResponseEntity<?> deleteImage(@PathVariable("id") String id,
                                         @PathVariable("imageId") String imageId) {
        try {
            datasetService.deleteImage(id, imageId);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (java.io.IOException ex) {
            return ResponseEntity.internalServerError().body(ex.getMessage());
        }
    }

    public static class CreateRequest {
        private String name;
        private String description;
        private String ownerId;
        private String scene;
        private String groupId;

        // getters/setters omitted for brevity
        public String getName() {return name;} public void setName(String n){name=n;}
        public String getDescription(){return description;} public void setDescription(String d){description=d;}
        public String getOwnerId(){return ownerId;} public void setOwnerId(String o){ownerId=o;}
        public String getScene(){return scene;} public void setScene(String s){scene=s;}
        public String getGroupId(){return groupId;} public void setGroupId(String g){groupId=g;}
    }
}