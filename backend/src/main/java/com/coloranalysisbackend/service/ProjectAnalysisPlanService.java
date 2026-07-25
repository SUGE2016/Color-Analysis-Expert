package com.coloranalysisbackend.service;

import com.coloranalysisbackend.model.Image;
import com.coloranalysisbackend.model.Project;
import com.coloranalysisbackend.repository.ImageRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Files;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class ProjectAnalysisPlanService {
    public static final List<String> PIPELINE_STEPS =
            List.of("hsv", "entropy", "main_color", "main_color_number");
    private static final String COLOR_DISTRIBUTION = "color_distribution";

    private final ImageRepository imageRepository;
    private final ProjectDraftStorage draftStorage;
    private final ObjectMapper objectMapper;

    public ProjectAnalysisPlanService(ImageRepository imageRepository,
                                      ProjectDraftStorage draftStorage,
                                      ObjectMapper objectMapper) {
        this.imageRepository = imageRepository;
        this.draftStorage = draftStorage;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> build(Project project) {
        Map<String, Object> config = readMap(project.getConfig());
        Map<String, Map<String, Object>> regions = validateRegions(config.get("regions"));
        Object rawImageConfig = config.get("imageAnalysisConfig");
        if (!(rawImageConfig instanceof Map<?, ?>)) {
            unprocessable("at least one image and region must be configured for color distribution analysis");
        }
        Map<?, ?> imageConfig = (Map<?, ?>) rawImageConfig;

        List<Map<String, Object>> plannedImages = new ArrayList<>();
        for (Map.Entry<?, ?> imageEntry : imageConfig.entrySet()) {
            String imageId = stringValue(imageEntry.getKey());
            if (imageId == null || !(imageEntry.getValue() instanceof Map<?, ?>)) {
                unprocessable("imageAnalysisConfig has an invalid image entry");
            }
            Map<?, ?> selectedRegions = (Map<?, ?>) imageEntry.getValue();
            if (selectedRegions.isEmpty()) {
                continue;
            }

            Image image = imageRepository.findById(imageId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                            "configured image not found: " + imageId));
            if (project.getDatasetIds() == null || !project.getDatasetIds().contains(image.getDatasetId())) {
                unprocessable("configured image does not belong to a selected dataset: " + imageId);
            }
            if (!Files.isRegularFile(draftStorage.correctedImage(project.getId(), imageId))) {
                unprocessable("corrected image is missing; return to step 2: " + imageId);
            }

            List<Map<String, Object>> plannedRegions = new ArrayList<>();
            for (Map.Entry<?, ?> regionEntry : selectedRegions.entrySet()) {
                String regionId = stringValue(regionEntry.getKey());
                Map<String, Object> region = regions.get(regionId);
                if (region == null) {
                    unprocessable("configured region does not exist in step 3: " + regionId);
                }
                if (!(regionEntry.getValue() instanceof List<?>)) {
                    unprocessable("selected region has no analysis method: " + regionId);
                }
                List<?> methods = (List<?>) regionEntry.getValue();
                if (methods.isEmpty()) {
                    unprocessable("selected region has no analysis method: " + regionId);
                }
                if (methods.size() != 1 || !COLOR_DISTRIBUTION.equals(stringValue(methods.get(0)))) {
                    unprocessable("V1.0 only supports color_distribution; boundary_check is not available");
                }

                Map<String, Object> plannedRegion = new LinkedHashMap<>();
                plannedRegion.put("regionId", regionId);
                plannedRegion.put("name", region.get("name"));
                plannedRegion.put("polygon", region.get("polygon"));
                plannedRegion.put("methods", List.of(COLOR_DISTRIBUTION));
                plannedRegions.add(plannedRegion);
            }
            if (plannedRegions.isEmpty()) continue;

            String stagedFileName = image.getDatasetId() + "__" + image.getId() + ".png";
            Map<String, Object> plannedImage = new LinkedHashMap<>();
            plannedImage.put("imageId", image.getId());
            plannedImage.put("datasetId", image.getDatasetId());
            plannedImage.put("originalFileName", image.getFileName());
            plannedImage.put("subjectCode", image.getSubjectCode());
            plannedImage.put("capturedAt", image.getCapturedAt());
            plannedImage.put("fileName", stagedFileName);
            plannedImage.put("regions", plannedRegions);
            plannedImages.add(plannedImage);
        }

        if (plannedImages.isEmpty()) {
            unprocessable("at least one image and region must be configured for color distribution analysis");
        }
        Map<String, Object> plan = new LinkedHashMap<>();
        plan.put("analysisConfigVersion", 1);
        plan.put("pipelineSteps", PIPELINE_STEPS);
        plan.put("images", plannedImages);
        return plan;
    }

    private Map<String, Map<String, Object>> validateRegions(Object rawRegions) {
        if (!(rawRegions instanceof List<?>)) {
            unprocessable("please define at least one analysis region in step 3");
        }
        List<?> regionList = (List<?>) rawRegions;
        if (regionList.isEmpty()) unprocessable("please define at least one analysis region in step 3");
        Map<String, Map<String, Object>> result = new LinkedHashMap<>();
        Set<String> ids = new HashSet<>();
        for (Object value : regionList) {
            if (!(value instanceof Map<?, ?>)) {
                unprocessable("step 3 region format is invalid");
            }
            Map<?, ?> rawRegion = (Map<?, ?>) value;
            String regionId = stringValue(rawRegion.get("regionId"));
            Object rawPolygon = rawRegion.get("polygon");
            if (regionId == null || !ids.add(regionId)
                    || !(rawPolygon instanceof List<?>)) {
                unprocessable("step 3 region format is invalid");
            }
            List<?> polygon = (List<?>) rawPolygon;
            if (polygon.size() < 3) unprocessable("step 3 region format is invalid");
            List<Map<String, Double>> normalizedPolygon = new ArrayList<>();
            for (Object rawPoint : polygon) {
                if (!(rawPoint instanceof Map<?, ?>)) {
                    unprocessable("region polygon coordinates must be normalized to [0,1]");
                }
                Map<?, ?> point = (Map<?, ?>) rawPoint;
                if (!(point.get("x") instanceof Number) || !(point.get("y") instanceof Number)) {
                    unprocessable("region polygon coordinates must be normalized to [0,1]");
                }
                Number x = (Number) point.get("x");
                Number y = (Number) point.get("y");
                if (x.doubleValue() < 0 || x.doubleValue() > 1
                        || y.doubleValue() < 0 || y.doubleValue() > 1) {
                    unprocessable("region polygon coordinates must be normalized to [0,1]");
                }
                normalizedPolygon.add(Map.of("x", x.doubleValue(), "y", y.doubleValue()));
            }
            Map<String, Object> region = new LinkedHashMap<>();
            region.put("regionId", regionId);
            region.put("name", stringValue(rawRegion.get("name")) == null ? regionId : rawRegion.get("name"));
            region.put("polygon", normalizedPolygon);
            result.put(regionId, region);
        }
        return result;
    }

    private Map<String, Object> readMap(String json) {
        try {
            return objectMapper.readValue(json == null ? "{}" : json, new TypeReference<>() {});
        } catch (Exception ex) {
            unprocessable("project config is invalid JSON");
            return Map.of();
        }
    }

    private String stringValue(Object value) {
        if (value == null) return null;
        String result = String.valueOf(value);
        return result.isBlank() ? null : result;
    }

    private void unprocessable(String message) {
        throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message);
    }
}
