package com.coloranalysisbackend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Table(name = "tasks")
@Data
public class Task {
    @Id
    private String id;

    @Column(name = "project_id")
    private String projectId;

    @Column(name = "task_type")
    private String taskType;

    private String status;

    // 参数、结果、日志字段均使用 JSON 字符串或数据库的 JSON 类型
    @Column(columnDefinition = "json")
    private String params;

    @Column(columnDefinition = "json")
    private String result;

    private String logs;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}