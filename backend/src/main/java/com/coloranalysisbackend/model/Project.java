package com.coloranalysisbackend.model;

import jakarta.persistence.Column;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "projects")
@Data
public class Project {
    @Id
    private String id;

    private String name;

    @Column(name = "owner_id")
    private String ownerId;

    @Column(name = "dataset_id")
    private String datasetId;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "project_datasets", joinColumns = @JoinColumn(name = "project_id"))
    @Column(name = "dataset_id")
    private Set<String> datasetIds = new LinkedHashSet<>();

    @Column(name = "template_id")
    private String templateId;

    @Column(columnDefinition = "json")
    private String config;

    @Column(name = "template_snapshot", columnDefinition = "json")
    private String templateSnapshot;

    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}
