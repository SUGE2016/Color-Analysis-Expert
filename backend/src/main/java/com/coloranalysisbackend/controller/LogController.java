package com.coloranalysisbackend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/logs")
@Tag(name = "后端日志", description = "后端运行日志查看")
public class LogController {

    private final Path logFile;

    public LogController(@Value("${logging.file.name:}") String logFileName) {
        this.logFile = (logFileName == null || logFileName.isBlank()) ? null : Path.of(logFileName);
    }

    @GetMapping("/backend")
    @Operation(summary = "读取后端日志尾部")
    public ResponseEntity<Map<String, Object>> backendLogs(
            @RequestParam(value = "lines", required = false, defaultValue = "300") int lines) {
        int safeLines = Math.max(1, Math.min(lines, 2000));
        if (logFile == null) {
            return ResponseEntity.ok(Map.of(
                    "available", false,
                    "path", "",
                    "lines", List.of(),
                    "message", "未配置 logging.file.name，无法读取后端日志文件"
            ));
        }
        if (!Files.exists(logFile)) {
            return ResponseEntity.ok(Map.of(
                    "available", false,
                    "path", logFile.toString(),
                    "lines", List.of(),
                    "message", "日志文件尚未生成"
            ));
        }

        try {
            List<String> allLines = Files.readAllLines(logFile, StandardCharsets.UTF_8);
            int from = Math.max(0, allLines.size() - safeLines);
            return ResponseEntity.ok(Map.of(
                    "available", true,
                    "path", logFile.toString(),
                    "lines", allLines.subList(from, allLines.size()),
                    "totalLines", allLines.size()
            ));
        } catch (IOException ex) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "available", false,
                    "path", logFile.toString(),
                    "lines", Collections.emptyList(),
                    "message", "读取日志失败: " + ex.getMessage()
            ));
        }
    }
}
