package com.coloranalysisbackend.controller;

import com.coloranalysisbackend.model.Task;
import com.coloranalysisbackend.repository.TaskRepository;
import com.coloranalysisbackend.service.RegionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/tasks")
@Tag(name = "任务管理", description = "异步任务提交与回调接口")
@RequiredArgsConstructor
public class TaskController {
    private final TaskRepository taskRepository;
    private final RegionService regionService;
    private final ObjectMapper objectMapper;

    /**
     * 提交区域识别任务
     */
    @PostMapping("/region-recognition")
    @Operation(summary = "提交区域识别任务")
    public ResponseEntity<Map<String, Object>> submitRegionRecognitionTask(@RequestBody Map<String, Object> request) {
        String taskId = UUID.randomUUID().toString();
        
        Task task = new Task();
        task.setId(taskId);
        task.setProjectId((String) request.get("image_id"));
        task.setTaskType("region-recognition");
        task.setStatus("PENDING");
        
        try {
            task.setParams(objectMapper.writeValueAsString(request.get("algorithm_config")));
        } catch (Exception e) {
            task.setParams("{}");
        }
        
        taskRepository.save(task);
        
        // TODO: 发布任务到 RabbitMQ（需要集成 Celery Worker）
        // 目前直接调用 Python 服务（临时方案）
        
        return ResponseEntity.ok(Map.of(
            "task_id", taskId,
            "status", "PENDING",
            "message", "区域识别任务已提交，请稍后查询结果。"
        ));
    }

    /**
     * 任务回调接口（Python Worker 调用）
     */
    @PostMapping("/{task_id}/callback")
    @Operation(summary = "任务结果回调")
    public ResponseEntity<Map<String, Object>> taskCallback(
            @PathVariable String task_id,
            @RequestBody Map<String, Object> callbackData) {
        
        Task task = taskRepository.findById(task_id).orElse(null);
        if (task == null) {
            return ResponseEntity.notFound().build();
        }
        
        String status = (String) callbackData.get("status");
        task.setStatus("SUCCESS".equals(status) ? "SUCCESS" : "FAILED");
        
        try {
            task.setResult(objectMapper.writeValueAsString(callbackData.get("result_payload")));
            task.setLogs((String) callbackData.get("logs"));
        } catch (Exception e) {
            task.setLogs("Failed to serialize result");
        }
        
        taskRepository.save(task);
        
        // 如果成功，保存区域数据
        if ("SUCCESS".equals(status)) {
            Map<String, Object> resultPayload = (Map<String, Object>) callbackData.get("result_payload");
            if (resultPayload != null && resultPayload.containsKey("regions")) {
                regionService.saveRegions(task.getProjectId(), 
                    (List<Map<String, Object>>) resultPayload.get("regions"));
            }
        }
        
        return ResponseEntity.ok(Map.of("status", "callback_received"));
    }

    /**
     * 查询任务状态
     */
    @GetMapping("/{task_id}")
    @Operation(summary = "查询任务状态")
    public ResponseEntity<Map<String, Object>> getTaskStatus(@PathVariable String task_id) {
        Task task = taskRepository.findById(task_id).orElse(null);
        if (task == null) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(Map.of(
            "task_id", task.getId(),
            "status", task.getStatus(),
            "result", task.getResult(),
            "logs", task.getLogs()
        ));
    }
}
