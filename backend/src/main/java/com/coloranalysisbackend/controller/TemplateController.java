package com.coloranalysisbackend.controller;

import com.coloranalysisbackend.model.Template;
import com.coloranalysisbackend.service.TemplateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.Resource;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Paths;
import java.util.List;

@RestController
@RequestMapping("/api/templates")
@Tag(name = "模板管理", description = "涂色模板的增删改查与图片上传")
public class TemplateController {

    private final TemplateService templateService;

    public TemplateController(TemplateService templateService) {
        this.templateService = templateService;
    }

    /** 创建模板（multipart：name和imageFile必填，regionsJson仅为兼容字段） */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "创建模板")
    public ResponseEntity<?> create(
            @RequestParam("name") String name,
            @RequestParam(value = "regionsJson", required = false) String regionsJson,
            @RequestParam("imageFile") MultipartFile imageFile) {
        try {
            Template t = templateService.createTemplate(name, regionsJson, imageFile);
            return ResponseEntity.ok(t);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (IOException ex) {
            return ResponseEntity.internalServerError().body(ex.getMessage());
        }
    }

    /** 查询模板列表 */
    @GetMapping
    @Operation(summary = "查询模板列表")
    public ResponseEntity<List<Template>> list() {
        return ResponseEntity.ok(templateService.listTemplates());
    }

    /** 查询模板详情 */
    @GetMapping("/{id}")
    @Operation(summary = "查询模板详情")
    public ResponseEntity<?> get(@PathVariable("id") String id) {
        Template t = templateService.getTemplate(id);
        if (t == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(t);
    }

    /** 更新模板（name/regionsJson/imageFile 均可选） */
    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "更新模板")
    public ResponseEntity<?> update(
            @PathVariable("id") String id,
            @RequestParam(value = "name", required = false) String name,
            @RequestParam(value = "regionsJson", required = false) String regionsJson,
            @RequestParam(value = "imageFile", required = false) MultipartFile imageFile) {
        try {
            Template t = templateService.updateTemplate(id, name, regionsJson, imageFile);
            return ResponseEntity.ok(t);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (IOException ex) {
            return ResponseEntity.internalServerError().body(ex.getMessage());
        }
    }

    /** 下载模板图片 */
    @GetMapping("/{id}/image/file")
    @Operation(summary = "下载模板图片")
    public ResponseEntity<Resource> imageFile(@PathVariable("id") String id) throws IOException {
        Resource resource = templateService.loadTemplateImageResource(id);
        if (resource == null) {
            return ResponseEntity.notFound().build();
        }
        Template t = templateService.getTemplate(id);
        MediaType type = templateService.guessMediaType(
                t != null && t.getTemplateImageKey() != null
                        ? Paths.get(t.getTemplateImageKey()).getFileName().toString()
                        : null);
        return ResponseEntity.ok()
                .contentType(type)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"template\"")
                .body(resource);
    }

    /** 单独上传/替换模板图片 */
    @PostMapping(value = "/{id}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "上传或替换模板图片")
    public ResponseEntity<?> uploadImage(@PathVariable("id") String id,
                                         @RequestParam("imageFile") MultipartFile imageFile) {
        try {
            Template t = templateService.updateTemplate(id, null, null, imageFile);
            return ResponseEntity.ok(t);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (IOException ex) {
            return ResponseEntity.internalServerError().body(ex.getMessage());
        }
    }

    /** 删除模板（有项目引用时拒绝） */
    @DeleteMapping("/{id}")
    @Operation(summary = "删除模板")
    public ResponseEntity<?> delete(@PathVariable("id") String id) {
        try {
            templateService.deleteTemplate(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(409).body(ex.getMessage());
        } catch (IOException ex) {
            return ResponseEntity.internalServerError().body(ex.getMessage());
        }
    }

    /** 获取模板图片 */
    @GetMapping("/{id}/image")
    @Operation(summary = "获取模板图片")
    public ResponseEntity<?> getImage(@PathVariable("id") String id) {
        Template t = templateService.getTemplate(id);
        if (t == null) {
            return ResponseEntity.notFound().build();
        }
        if (t.getTemplateImageKey() == null) {
            return ResponseEntity.notFound().build();
        }
        try {
            java.nio.file.Path imagePath = templateService.getTemplateImagePath(t);
            if (imagePath == null) {
                return ResponseEntity.notFound().build();
            }
            byte[] imageBytes = java.nio.file.Files.readAllBytes(imagePath);

            // 根据文件扩展名设置Content-Type
            String fileName = imagePath.getFileName().toString().toLowerCase();
            MediaType mediaType;
            if (fileName.endsWith(".png")) {
                mediaType = MediaType.IMAGE_PNG;
            } else if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) {
                mediaType = MediaType.IMAGE_JPEG;
            } else if (fileName.endsWith(".gif")) {
                mediaType = MediaType.IMAGE_GIF;
            } else if (fileName.endsWith(".webp")) {
                mediaType = MediaType.valueOf("image/webp");
            } else {
                mediaType = MediaType.APPLICATION_OCTET_STREAM;
            }

            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .body(imageBytes);
        } catch (IOException ex) {
            return ResponseEntity.internalServerError().body(ex.getMessage());
        }
    }
}
