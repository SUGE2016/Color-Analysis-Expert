package com.coloranalysisbackend.controller;

import com.coloranalysisbackend.service.PythonClientService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/images")
@Tag(name = "图像工具", description = "图像矫正、边缘检测与HSV处理工具接口")
public class ImageController {

    private final PythonClientService pythonClientService;
    private final ObjectMapper objectMapper;

    public ImageController(PythonClientService pythonClientService, ObjectMapper objectMapper) {
        this.pythonClientService = pythonClientService;
        this.objectMapper = objectMapper;
    }

    /**
     * 把上传的图像发送给本地的 Python 服务进行 Canny 边缘检测
     */
    @PostMapping(value = "/canny", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Canny边缘检测")
    public ResponseEntity<Map<String,Object>> canny(@RequestParam("file") MultipartFile file,
                                                    @RequestParam(value = "config", required = false) String config) throws IOException {
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
        byte[] input = file.getBytes();
        Map<String,Object> result = pythonClientService.detectPoints(input);
        return ResponseEntity.ok(result);
    }

    @PostMapping(value = "/correction/align", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "执行图像矫正")
    public ResponseEntity<byte[]> align(@RequestParam("model") MultipartFile model,
                                        @RequestParam("image") MultipartFile image) throws IOException {
        byte[] out = pythonClientService.alignImage(model.getBytes(), image.getBytes());
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .body(out);
    }

    @PostMapping(value = "/hsv/process", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "执行HSV掩膜处理")
    public ResponseEntity<byte[]> hsvProcess(@RequestParam("image") MultipartFile image,
                                             @RequestParam("mask") MultipartFile mask) throws IOException {
        byte[] out = pythonClientService.hsvProcess(image.getBytes(), mask.getBytes());
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .body(out);
    }
}
