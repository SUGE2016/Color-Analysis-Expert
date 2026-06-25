package com.coloranalysisbackend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

@Entity
@Table(name = "templates")
@Data
public class Template {
    @Id
    private String id;

    /** 模板名称（必填） */
    private String name;

    /** 模板图片在本地存储中的路径 */
    @Column(name = "template_image_key")
    private String templateImageKey;

    /**
     * 区域 JSON 定义（可选）
     * 格式示例：[{"id":"r1","label":"头部","polygon":[[x,y],...]}]
     */
    @Column(name = "regions_json", columnDefinition = "json")
    private String regionsJson;

    @Column(name = "created_at", insertable = false, updatable = false)
    private java.time.LocalDateTime createdAt;
}
