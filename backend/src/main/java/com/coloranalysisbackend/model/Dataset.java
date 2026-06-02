package com.coloranalysisbackend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

@Entity
@Table(name = "datasets")
@Data
public class Dataset {
    @Id
    private String id;

    private String name;

    private String description;

    @Column(name = "owner_id")
    private String ownerId;

    @Column(name = "storage_prefix")
    private String storagePrefix;

    @Column(name = "file_count")
    private Integer fileCount;

    // 选填：所属场景
    private String scene;

    @Column(name = "group_id")
    private String groupId;
}