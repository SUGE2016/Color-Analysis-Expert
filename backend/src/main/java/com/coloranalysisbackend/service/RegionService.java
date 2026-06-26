package com.coloranalysisbackend.service;

import com.coloranalysisbackend.model.Region;
import com.coloranalysisbackend.repository.RegionRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class RegionService {
    private final RegionRepository regionRepository;
    private final ObjectMapper objectMapper;

    /**
     * 保存区域列表
     */
    @Transactional
    public void saveRegions(String imageId, List<Map<String, Object>> regionsData) {
        // 先删除该图片的所有旧区域
        regionRepository.deleteByImageId(imageId);

        // 保存新区域
        for (Map<String, Object> regionData : regionsData) {
            Region region = new Region();
            region.setImageId(imageId);
            region.setRegionId((String) regionData.get("regionId"));
            region.setName((String) regionData.get("name"));
            region.setType("polygon");
            
            try {
                region.setPoints(objectMapper.writeValueAsString(regionData.get("polygon")));
                region.setBoundingBox(objectMapper.writeValueAsString(regionData.get("bounding_box")));
            } catch (Exception e) {
                throw new RuntimeException("Failed to serialize region data", e);
            }
            
            region.setColor((String) regionData.get("color"));
            regionRepository.save(region);
        }
    }

    /**
     * 获取图片的所有区域
     */
    public List<Region> getRegionsByImageId(String imageId) {
        return regionRepository.findByImageId(imageId);
    }

    /**
     * 根据光标坐标匹配区域（点选识别）
     * @param imageId 图片ID
     * @param x 归一化X坐标 (0.0-1.0)
     * @param y 归一化Y坐标 (0.0-1.0)
     * @return 匹配到的区域，如果没有匹配到则返回null
     */
    public Region findRegionAtPoint(String imageId, double x, double y) {
        List<Region> regions = regionRepository.findByImageId(imageId);
        
        for (Region region : regions) {
            if (isPointInPolygon(x, y, region)) {
                return region;
            }
        }
        
        return null;
    }

    /**
     * 判断点是否在多边形内（射线法）
     */
    private boolean isPointInPolygon(double x, double y, Region region) {
        try {
            List<Map<String, Double>> points = objectMapper.readValue(
                region.getPoints(),
                new TypeReference<List<Map<String, Double>>>() {}
            );
            
            if (points.size() < 3) {
                return false;
            }
            
            int n = points.size();
            boolean inside = false;
            
            for (int i = 0, j = n - 1; i < n; j = i++) {
                double xi = points.get(i).get("x");
                double yi = points.get(i).get("y");
                double xj = points.get(j).get("x");
                double yj = points.get(j).get("y");
                
                if (((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                    inside = !inside;
                }
            }
            
            return inside;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 删除图片的所有区域
     */
    @Transactional
    public void deleteRegionsByImageId(String imageId) {
        regionRepository.deleteByImageId(imageId);
    }

    /**
     * 删除单个区域
     */
    @Transactional
    public void deleteRegion(String regionId) {
        regionRepository.deleteById(regionId);
    }
}
