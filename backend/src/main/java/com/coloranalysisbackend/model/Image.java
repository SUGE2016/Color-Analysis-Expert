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
}