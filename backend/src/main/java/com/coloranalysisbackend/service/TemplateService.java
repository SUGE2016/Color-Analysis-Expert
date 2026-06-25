package com.coloranalysisbackend.service;

import com.coloranalysisbackend.model.Template;
import com.coloranalysisbackend.repository.ProjectRepository;
import com.coloranalysisbackend.repository.TemplateRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

@Service
public class TemplateService {

    private final TemplateRepository templateRepository;
    private final ProjectRepository projectRepository;
    private final Path baseDir;

    public TemplateService(TemplateRepository templateRepository,
                           ProjectRepository projectRepository,
                           @Value("${storage.base-dir}") String baseDir) throws IOException {
        this.templateRepository = templateRepository;
        this.projectRepository = projectRepository;
        this.baseDir = Paths.get(baseDir);
        if (!Files.exists(this.baseDir)) {
            Files.createDirectories(this.baseDir);
        }
    }

    /** 创建模板（图片可选） */
    public Template createTemplate(String name, String regionsJson, MultipartFile imageFile) throws IOException {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("template name is required");
        }
        Template t = new Template();
        t.setId(UUID.randomUUID().toString());
        t.setName(name);
        t.setRegionsJson((regionsJson == null || regionsJson.isBlank()) ? null : regionsJson);

        if (imageFile != null && !imageFile.isEmpty()) {
            String imageKey = saveTemplateImage(t.getId(), imageFile);
            t.setTemplateImageKey(imageKey);
        }

        return templateRepository.save(t);
    }

    /** 查询所有模板 */
    public List<Template> listTemplates() {
        return templateRepository.findAll();
    }

    /** 查询单个模板 */
    public Template getTemplate(String id) {
        return templateRepository.findById(id).orElse(null);
    }

    /** 更新模板（名称/区域定义/替换图片） */
    public Template updateTemplate(String id, String name, String regionsJson, MultipartFile imageFile) throws IOException {
        Template t = templateRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("template not found: " + id));

        if (name != null && !name.isBlank()) {
            t.setName(name);
        }
        if (regionsJson != null) {
            t.setRegionsJson(regionsJson.isBlank() ? null : regionsJson);
        }
        if (imageFile != null && !imageFile.isEmpty()) {
            // 删除旧文件
            if (t.getTemplateImageKey() != null) {
                Path old = Paths.get(t.getTemplateImageKey());
                Files.deleteIfExists(old);
            }
            String imageKey = saveTemplateImage(id, imageFile);
            t.setTemplateImageKey(imageKey);
        }

        return templateRepository.save(t);
    }

    /** 删除模板。若仍有项目引用则拒绝 */
    public void deleteTemplate(String id) throws IOException {
        Template t = templateRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("template not found: " + id));

        long refCount = projectRepository.findAll().stream()
                .filter(p -> id.equals(p.getTemplateId()))
                .count();
        if (refCount > 0) {
            throw new IllegalStateException("cannot delete template: " + refCount + " project(s) still reference it");
        }

        if (t.getTemplateImageKey() != null) {
            Path imgPath = Paths.get(t.getTemplateImageKey());
            Files.deleteIfExists(imgPath);
        }
        templateRepository.deleteById(id);
    }

    // ---------- private helpers ----------

    private String saveTemplateImage(String templateId, MultipartFile file) throws IOException {
        Path dir = baseDir.resolve("templates").resolve(templateId);
        if (!Files.exists(dir)) {
            Files.createDirectories(dir);
        }
        String filename = file.getOriginalFilename();
        if (filename == null || filename.isBlank()) {
            filename = "template_image";
        }
        Path target = dir.resolve(filename);
        Files.copy(file.getInputStream(), target);
        return target.toString();
    }
}
