package com.coloranalysisbackend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

@Entity
@Table(name = "dataset_groups")
@Data
public class DatasetGroup {
    @Id
    private String id;

    private String name;

    private String description;

    @Column(name = "academic_year")
    private Integer academicYear;
}
