package com.coloranalysisbackend.model;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Table(name = "regions")
@Data
public class Region {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "image_id")
    private String imageId;

    @Column(name = "region_id")
    private String regionId; // 如 "region1", "region2"

    @Column(name = "name")
    private String name;

    @Column(name = "type")
    private String type; // "polygon"

    @Column(columnDefinition = "json")
    private String points; // JSON数组 [{"x": 0.12, "y": 0.34}, ...]

    @Column(columnDefinition = "json")
    private String boundingBox; // JSON对象 {"x": 0.1, "y": 0.3, "w": 0.05, "h": 0.08}

    @Column(name = "color")
    private String color;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
