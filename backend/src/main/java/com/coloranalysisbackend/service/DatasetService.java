package com.coloranalysisbackend.service;

import com.coloranalysisbackend.model.Dataset;
import com.coloranalysisbackend.model.DatasetGroup;
import com.coloranalysisbackend.model.Image;
import com.coloranalysisbackend.repository.DatasetRepository;
import com.coloranalysisbackend.repository.DatasetGroupRepository;
import com.coloranalysisbackend.repository.ImageRepository;
import com.coloranalysisbackend.repository.ProjectRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.MediaType;

@Service
public class DatasetService {
    private static final Set<String> ALLOWED_SCENES = new HashSet<>(Arrays.asList(
            "儿童发展评估",
            "教育研究",
            "精细控制能力评估",
            "色彩认知研究",
            "其他"
    ));

    private final DatasetRepository datasetRepository;
    private final DatasetGroupRepository datasetGroupRepository;
    private final ImageRepository imageRepository;
    private final ProjectRepository projectRepository;
    private final Path baseDir;

    public DatasetService(DatasetRepository datasetRepository,
                          DatasetGroupRepository datasetGroupRepository,
                          ImageRepository imageRepository,
                          ProjectRepository projectRepository,
                          @Value("${storage.base-dir}") String baseDir) throws IOException {
        this.datasetRepository = datasetRepository;
        this.datasetGroupRepository = datasetGroupRepository;
        this.imageRepository = imageRepository;
        this.projectRepository = projectRepository;
        this.baseDir = Paths.get(baseDir);
        if (!Files.exists(this.baseDir)) {
            Files.createDirectories(this.baseDir);
        }
    }

    public Dataset createDataset(String name,
                                 String description,
                                 String ownerId,
                                 String scene,
                                 String groupId,
                                 Integer academicYear) {
        if (scene != null && !scene.isBlank() && !ALLOWED_SCENES.contains(scene)) {
            throw new IllegalArgumentException("scene must be one of: 儿童发展评估、教育研究、精细控制能力评估、色彩认知研究、其他");
        }
        if (groupId != null && !groupId.isBlank() && datasetGroupRepository.findById(groupId).isEmpty()) {
            throw new IllegalArgumentException("dataset group not found");
        }

        Dataset d = new Dataset();
        d.setId(UUID.randomUUID().toString());
        d.setName(name);
        d.setDescription(description);
        d.setOwnerId(ownerId);
        d.setStoragePrefix(d.getId());
        d.setFileCount(0);
        d.setScene((scene == null || scene.isBlank()) ? null : scene);
        d.setGroupId((groupId == null || groupId.isBlank()) ? null : groupId);
        d.setAcademicYear(academicYear);
        return datasetRepository.save(d);
    }

    public Dataset getDataset(String id) {
        return datasetRepository.findById(id).orElse(null);
    }

    public List<Dataset> listDatasets(String groupId, String scene, Integer academicYear) {
        boolean hasGroup = groupId != null && !groupId.isBlank();
        boolean hasScene = scene != null && !scene.isBlank();
        boolean hasYear = academicYear != null;

        if (hasScene && !ALLOWED_SCENES.contains(scene)) {
            throw new IllegalArgumentException("scene must be one of: 儿童发展评估、教育研究、精细控制能力评估、色彩认知研究、其他");
        }

        if (hasGroup && hasYear) {
            List<Dataset> list = datasetRepository.findByGroupIdAndAcademicYear(groupId, academicYear);
            if (hasScene) {
                return list.stream().filter(d -> scene.equals(d.getScene())).toList();
            }
            return list;
        }
        if (hasGroup && hasScene) {
            return datasetRepository.findByGroupIdAndScene(groupId, scene);
        }
        if (hasGroup) {
            return datasetRepository.findByGroupId(groupId);
        }
        if (hasScene) {
            return datasetRepository.findByScene(scene);
        }
        return datasetRepository.findAll();
    }

    public DatasetGroup createGroup(String name, String description, Integer academicYear) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("group name is required");
        }
        DatasetGroup group = new DatasetGroup();
        group.setId(UUID.randomUUID().toString());
        group.setName(name);
        group.setDescription(description);
        group.setAcademicYear(academicYear);
        return datasetGroupRepository.save(group);
    }

    public List<DatasetGroup> listGroups(Integer academicYear) {
        if (academicYear != null) {
            return datasetGroupRepository.findByAcademicYear(academicYear);
        }
        return datasetGroupRepository.findAll();
    }

    public DatasetGroup getGroup(String groupId) {
        return datasetGroupRepository.findById(groupId).orElse(null);
    }

    public Image storeImage(String datasetId, MultipartFile file, String subjectCode, String label) throws IOException {
        Dataset ds = getDataset(datasetId);
        if (ds == null) {
            throw new IllegalArgumentException("dataset not found");
        }
        String filename = file.getOriginalFilename();
        if (filename == null) {
            filename = UUID.randomUUID().toString();
        }
        Path dir = baseDir.resolve(ds.getStoragePrefix());
        if (!Files.exists(dir)) {
            Files.createDirectories(dir);
        }
        Path target = dir.resolve(filename);
        Files.copy(file.getInputStream(), target);
        Image img = new Image();
        img.setId(UUID.randomUUID().toString());
        img.setDatasetId(datasetId);
        img.setFileName(filename);
        img.setStorageKey(target.toString());
        if (subjectCode != null && !subjectCode.isBlank()) {
            img.setSubjectCode(subjectCode.trim());
        }
        if (label != null && !label.isBlank()) {
            img.setLabel(label.trim());
        }
        img.setCapturedAt(LocalDateTime.now());
        img = imageRepository.save(img);

        // 使用数据库查询来获取准确的图片数量，避免并发问题
        long actualCount = imageRepository.countByDatasetId(datasetId);
        ds.setFileCount((int) actualCount);
        datasetRepository.save(ds);

        return img;
    }

    public List<Image> listImages(String datasetId) {
        return imageRepository.findByDatasetId(datasetId);
    }

    public Image getImage(String datasetId, String imageId) {
        Image img = imageRepository.findById(imageId).orElse(null);
        if (img == null || !datasetId.equals(img.getDatasetId())) {
            return null;
        }
        return img;
    }

    public Resource loadImageResource(String datasetId, String imageId) throws IOException {
        Image img = getImage(datasetId, imageId);
        if (img == null || img.getStorageKey() == null) {
            return null;
        }
        Path path = Paths.get(img.getStorageKey());
        if (!Files.exists(path)) {
            return null;
        }
        Resource resource = new UrlResource(path.toUri());
        if (!resource.exists() || !resource.isReadable()) {
            return null;
        }
        return resource;
    }

    public MediaType guessMediaType(String fileName) {
        if (fileName != null && fileName.toLowerCase().endsWith(".png")) {
            return MediaType.IMAGE_PNG;
        }
        return MediaType.IMAGE_JPEG;
    }

    public Image updateImageMeta(String datasetId, String imageId, String subjectCode, String label) {
        Image img = imageRepository.findById(imageId)
                .orElseThrow(() -> new IllegalArgumentException("image not found: " + imageId));
        if (!datasetId.equals(img.getDatasetId())) {
            throw new IllegalArgumentException("image does not belong to this dataset");
        }
        if (subjectCode != null) {
            img.setSubjectCode(subjectCode.isBlank() ? null : subjectCode.trim());
        }
        if (label != null) {
            img.setLabel(label.isBlank() ? null : label.trim());
        }
        return imageRepository.save(img);
    }

    /** 更新数据集元数据（name/description/scene/groupId 均可选传入） */
    public Dataset updateDataset(String id, String name, String description, String scene, String groupId, Integer academicYear) {
        Dataset d = datasetRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("dataset not found: " + id));

        if (name != null && !name.isBlank()) {
            d.setName(name);
        }
        if (description != null) {
            d.setDescription(description.isBlank() ? null : description);
        }
        if (scene != null) {
            if (!scene.isBlank() && !ALLOWED_SCENES.contains(scene)) {
                throw new IllegalArgumentException("scene must be one of: 儿童发展评估、教育研究、精细控制能力评估、色彩认知研究、其他");
            }
            d.setScene(scene.isBlank() ? null : scene);
        }
        if (groupId != null) {
            if (!groupId.isBlank() && datasetGroupRepository.findById(groupId).isEmpty()) {
                throw new IllegalArgumentException("dataset group not found");
            }
            d.setGroupId(groupId.isBlank() ? null : groupId);
        }
        if (academicYear != null) {
            d.setAcademicYear(academicYear);
        }
        return datasetRepository.save(d);
    }

    /** 删除数据集（若有项目引用则拒绝） */
    public void deleteDataset(String id) {
        Dataset d = datasetRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("dataset not found: " + id));
        if (projectRepository.existsByDatasetId(id)) {
            throw new IllegalStateException("cannot delete dataset: it is referenced by one or more projects");
        }
        // 删除本地文件目录
        Path dir = baseDir.resolve(d.getStoragePrefix() != null ? d.getStoragePrefix() : id);
        if (Files.exists(dir)) {
            try {
                deleteDirectoryRecursively(dir);
            } catch (IOException ignored) {
            }
        }
        datasetRepository.deleteById(id);
    }

    /** 更新数据集分组 */
    public DatasetGroup updateGroup(String id, String name, String description, Integer academicYear) {
        DatasetGroup g = datasetGroupRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("dataset group not found: " + id));
        if (name != null && !name.isBlank()) {
            g.setName(name);
        }
        if (description != null) {
            g.setDescription(description.isBlank() ? null : description);
        }
        if (academicYear != null) {
            g.setAcademicYear(academicYear);
        }
        return datasetGroupRepository.save(g);
    }

    /** 删除数据集分组（若有数据集引用则拒绝） */
    public void deleteGroup(String id) {
        datasetGroupRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("dataset group not found: " + id));
        if (datasetRepository.existsByGroupId(id)) {
            throw new IllegalStateException("cannot delete group: one or more datasets still belong to it");
        }
        datasetGroupRepository.deleteById(id);
    }

    /** 删除数据集内单张图片 */
    public void deleteImage(String datasetId, String imageId) throws IOException {
        Dataset ds = datasetRepository.findById(datasetId)
                .orElseThrow(() -> new IllegalArgumentException("dataset not found: " + datasetId));
        Image img = imageRepository.findById(imageId)
                .orElseThrow(() -> new IllegalArgumentException("image not found: " + imageId));
        if (!datasetId.equals(img.getDatasetId())) {
            throw new IllegalArgumentException("image does not belong to this dataset");
        }
        if (img.getStorageKey() != null) {
            Files.deleteIfExists(Paths.get(img.getStorageKey()));
        }
        imageRepository.deleteById(imageId);

        // 使用数据库查询来获取准确的图片数量，避免并发问题
        long actualCount = imageRepository.countByDatasetId(datasetId);
        ds.setFileCount((int) actualCount);
        datasetRepository.save(ds);
    }

    /** 重新计算数据集的fileCount，确保与实际图片数量一致 */
    public Dataset recalculateFileCount(String datasetId) {
        Dataset ds = datasetRepository.findById(datasetId)
                .orElseThrow(() -> new IllegalArgumentException("dataset not found: " + datasetId));
        List<Image> images = imageRepository.findByDatasetId(datasetId);
        int actualCount = images.size();
        ds.setFileCount(actualCount);
        return datasetRepository.save(ds);
    }

    /** 重新计算所有数据集的fileCount */
    public void recalculateAllFileCounts() {
        List<Dataset> allDatasets = datasetRepository.findAll();
        for (Dataset ds : allDatasets) {
            List<Image> images = imageRepository.findByDatasetId(ds.getId());
            int actualCount = images.size();
            if (ds.getFileCount() != actualCount) {
                ds.setFileCount(actualCount);
                datasetRepository.save(ds);
            }
        }
    }

    // ---------- private helpers ----------

    private void deleteDirectoryRecursively(Path dir) throws IOException {
        if (Files.isDirectory(dir)) {
            try (var entries = Files.list(dir)) {
                for (Path entry : entries.toList()) {
                    deleteDirectoryRecursively(entry);
                }
            }
        }
        Files.deleteIfExists(dir);
    }
}