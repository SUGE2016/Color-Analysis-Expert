package com.coloranalysisbackend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

@Entity
@Table(name = "images")
@Data
public class Image {
    @Id
    private String id;

    @Column(name = "dataset_id")
    private String datasetId;

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "storage_key")
    private String storageKey;

    private Integer width;
    private Integer height;
    private String md5;

    /** 儿童编号（匿名化标识，用于纵向追踪） */
    @Column(name = "subject_code")
    private String subjectCode;

    private String label;

    @Column(name = "captured_at")
    private java.time.LocalDateTime capturedAt;
}