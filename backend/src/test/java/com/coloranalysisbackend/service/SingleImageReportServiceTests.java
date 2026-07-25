package com.coloranalysisbackend.service;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SingleImageReportServiceTests {

    @Test
    void colorDistributionKeepsCountsAndCalculatesRatios() {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("image_name", "dataset__image.png");
        row.put("region_id", "region-1");
        row.put("region_alias", "区域1");
        row.put("valid_pixels", "10");
        row.put("blue", "7");
        row.put("uncategorized", "3");

        List<Map<String, Object>> metrics =
                SingleImageReportService.metricItems(row, 10, true);

        assertEquals(2, metrics.size());
        assertEquals("蓝色", metrics.get(0).get("label"));
        assertEquals(7L, metrics.get(0).get("count"));
        assertEquals(0.7d, (Double) metrics.get(0).get("ratio"), 0.000001d);
        assertEquals("未分类", metrics.get(1).get("label"));
        assertEquals(0.3d, (Double) metrics.get(1).get("ratio"), 0.000001d);
    }

    @Test
    void zeroPixelRegionProducesFiniteZeroRatio() {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("red", "0");

        List<Map<String, Object>> metrics =
                SingleImageReportService.metricItems(row, 0, true);

        assertEquals(0d, metrics.get(0).get("ratio"));
        assertTrue(Double.isFinite((Double) metrics.get(0).get("ratio")));
    }

    @Test
    void mainColorPixelCountsDoNotPretendToBeColorKinds() {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("dark_blue", "946");

        List<Map<String, Object>> metrics =
                SingleImageReportService.metricItems(row, 2564, false);

        assertEquals("深蓝色", metrics.get(0).get("label"));
        assertEquals(946L, metrics.get(0).get("count"));
        assertTrue(!metrics.get(0).containsKey("ratio"));
    }
}
