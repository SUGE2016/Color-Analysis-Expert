package com.coloranalysisbackend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

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

    @Column(name = "template_id")
    private String templateId;

    @Column(columnDefinition = "json")
    private String config;

    private String status;
}
