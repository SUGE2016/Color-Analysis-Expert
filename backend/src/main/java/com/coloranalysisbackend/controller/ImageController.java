package com.coloranalysisbackend.controller;

import com.coloranalysisbackend.model.Region;
import com.coloranalysisbackend.service.PythonClientService;
import com.coloranalysisbackend.service.RegionService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/images")
@Tag(name = "图像工具", description = "图像矫正、边缘检测与HSV处理工具接口")
public class ImageController {

    private final PythonClientService pythonClientService;
    private final RegionService regionService;
    private final ObjectMapper objectMapper;

    public ImageController(PythonClientService pythonClientService, RegionService regionService, ObjectMapper objectMapper) {
        this.pythonClientService = pythonClientService;
        this.regionService = regionService;
        this.objectMapper = objectMapper;
    }

    /**
     * 把上传的图像发送给本地的 Python 服务进行 Canny 边缘检测
     */
    @PostMapping(value = "/canny", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Canny边缘检测")
    public ResponseEntity<Map<String,Object>> canny(@RequestParam("file") MultipartFile file,
                                                    @RequestParam(value = "config", required = false) String config) throws IOException {
        validateImageFile(file);
        byte[] input = file.getBytes();
        Map<String,Object> cfg = Map.of();
        if (config != null && !config.isBlank()) {
            cfg = objectMapper.readValue(config, new TypeReference<Map<String,Object>>() {});
        }
        Map<String,Object> result = pythonClientService.detectCanny(input, cfg);
        return ResponseEntity.ok(result);
    }

    @PostMapping(value = "/correction/points", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "检测图像矫正角点")
    public ResponseEntity<Map<String,Object>> detectPoints(@RequestParam("file") MultipartFile file) throws IOException {
        validateImageFile(file);
        byte[] input = file.getBytes();
        Map<String,Object> result = pythonClientService.detectPoints(input);
        return ResponseEntity.ok(result);
    }

    @PostMapping(value = "/correction/align", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "执行图像矫正")
    public ResponseEntity<?> align(@RequestParam("model") MultipartFile model,
                                   @RequestParam("image") MultipartFile image) throws IOException {
        try {
            validateImageFile(model);
            validateImageFile(image);
            byte[] out = pythonClientService.alignImage(model.getBytes(), image.getBytes());
            if (out == null || out.length == 0) {
                return ResponseEntity.status(502).body(Map.of("error", "alignment failed: empty image response"));
            }
            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_PNG)
                    .body(out);
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(422).body(Map.of("error", ex.getMessage()));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping(value = "/hsv/process", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "执行HSV掩膜处理")
    public ResponseEntity<byte[]> hsvProcess(@RequestParam("image") MultipartFile image,
                                             @RequestParam("mask") MultipartFile mask) throws IOException {
        validateImageFile(image);
        validateImageFile(mask);
        byte[] out = pythonClientService.hsvProcess(image.getBytes(), mask.getBytes());
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .body(out);
    }

    private void validateImageFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("image file is required");
        }
        String contentType = file.getContentType();
        if (contentType != null && !contentType.toLowerCase().startsWith("image/")) {
            throw new IllegalArgumentException("only image files are supported");
        }
    }

    /**
     * 点选识别：根据光标坐标匹配区域
     */
    @GetMapping("/{image_id}/region/at-point")
    @Operation(summary = "点选识别区域")
    public ResponseEntity<Map<String, Object>> getRegionAtPoint(
            @PathVariable String image_id,
            @RequestParam double x,
            @RequestParam double y) {
        
        Region region = regionService.findRegionAtPoint(image_id, x, y);
        
        if (region == null) {
            return ResponseEntity.notFound().build();
        }
        
        try {
            Map<String, Object> response = Map.of(
                "region_id", region.getRegionId(),
                "type", region.getType(),
                "points", objectMapper.readValue(region.getPoints(), new TypeReference<List<Map<String, Double>>>() {}),
                "bounding_box", objectMapper.readValue(region.getBoundingBox(), new TypeReference<Map<String, Double>>() {})
            );
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to parse region data"));
        }
    }

    /**
     * 获取图片的所有区域
     */
    @GetMapping("/{image_id}/regions")
    @Operation(summary = "获取图片的所有区域")
    public ResponseEntity<List<Region>> getRegions(@PathVariable String image_id) {
        List<Region> regions = regionService.getRegionsByImageId(image_id);
        return ResponseEntity.ok(regions);
    }

    /**
     * 删除图片的所有区域
     */
    @DeleteMapping("/{image_id}/regions")
    @Operation(summary = "删除图片的所有区域")
    public ResponseEntity<Map<String, String>> deleteRegions(@PathVariable String image_id) {
        regionService.deleteRegionsByImageId(image_id);
        return ResponseEntity.ok(Map.of("message", "Regions deleted successfully"));
    }
}
