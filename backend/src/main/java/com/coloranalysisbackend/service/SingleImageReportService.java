package com.coloranalysisbackend.service;

import com.coloranalysisbackend.model.Project;
import com.coloranalysisbackend.model.Task;
import com.coloranalysisbackend.repository.TaskRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.fontbox.ttf.TrueTypeCollection;
import org.apache.fontbox.ttf.TrueTypeFont;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.graphics.image.JPEGFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class SingleImageReportService {
    private static final Set<String> FIXED_COLUMNS =
            Set.of("image_name", "region_id", "region_alias", "valid_pixels");
    private static final Map<String, ColorInfo> COLORS = colorDefinitions();
    private static final Path DEFAULT_CJK_FONT =
            Paths.get("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc");

    private final TaskRepository taskRepository;
    private final ObjectMapper objectMapper;
    private final Path storageBaseDir;
    private final Path pdfFontPath;

    public SingleImageReportService(TaskRepository taskRepository,
                                    ObjectMapper objectMapper,
                                    @Value("${storage.base-dir}") String storageBaseDir,
                                    @Value("${report.pdf-font:/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc}")
                                    String pdfFontPath) {
        this.taskRepository = taskRepository;
        this.objectMapper = objectMapper;
        this.storageBaseDir = Paths.get(storageBaseDir).toAbsolutePath().normalize();
        this.pdfFontPath = Paths.get(pdfFontPath == null || pdfFontPath.isBlank()
                ? DEFAULT_CJK_FONT.toString() : pdfFontPath);
    }

    public List<Map<String, Object>> listImages(String projectId) {
        Task task = latestSuccessTask(projectId);
        List<ImageSnapshot> snapshots = snapshots(task);
        List<Map<String, Object>> result = new ArrayList<>();
        for (ImageSnapshot snapshot : snapshots) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("imageId", snapshot.imageId());
            row.put("datasetId", snapshot.datasetId());
            row.put("fileName", snapshot.originalFileName());
            row.put("displayName", snapshot.originalFileName());
            row.put("regionCount", snapshot.regions().size());
            result.add(row);
        }
        return result;
    }

    public Map<String, Object> getReport(Project project, String imageToken) {
        Task task = latestSuccessTask(project.getId());
        ResolvedImage resolved = resolveImage(task, imageToken);
        ImageSnapshot snapshot = resolved.snapshot();
        Map<String, String> files = resultFiles(task);

        List<Map<String, String>> colorRows = requiredCsv(files, "mainColorCsv", resolved.legacy());
        List<Map<String, String>> numberRows = requiredCsv(files, "mainColorNumberCsv", resolved.legacy());
        List<Map<String, String>> entropyRows = requiredCsv(files, "entropyCsv", resolved.legacy());

        Map<String, Map<String, String>> colorByRegion = rowsByRegion(colorRows, snapshot.stagedFileName());
        Map<String, Map<String, String>> numberByRegion = rowsByRegion(numberRows, snapshot.stagedFileName());
        Map<String, Map<String, String>> entropyByRegion = rowsByRegion(entropyRows, snapshot.stagedFileName());

        List<RegionSnapshot> regionSnapshots = snapshot.regions();
        if (regionSnapshots.isEmpty()) {
            regionSnapshots = legacyRegions(colorByRegion, numberByRegion, entropyByRegion);
        }
        if (regionSnapshots.isEmpty()) {
            throw unprocessable("report contains no analyzable region data");
        }

        List<Map<String, Object>> regions = new ArrayList<>();
        for (RegionSnapshot region : regionSnapshots) {
            Map<String, String> colorRow = colorByRegion.get(region.regionId());
            Map<String, String> numberRow = numberByRegion.get(region.regionId());
            Map<String, String> entropyRow = entropyByRegion.get(region.regionId());
            if (!resolved.legacy() && (colorRow == null || numberRow == null || entropyRow == null)) {
                throw unprocessable("required report metric is missing for region: " + region.regionId());
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("regionId", region.regionId());
            item.put("name", region.name());
            item.put("polygon", region.polygon());
            long validPixels = longValue(colorRow == null ? null : colorRow.get("valid_pixels"));
            item.put("validPixels", validPixels);
            item.put("colorDistribution", metricItems(colorRow, validPixels, true));
            item.put("mainColorNumber", metricItems(numberRow,
                    longValue(numberRow == null ? null : numberRow.get("valid_pixels")), false));
            item.put("entropy", entropyValues(entropyRow));
            regions.add(item);
        }

        Map<String, Object> projectInfo = new LinkedHashMap<>();
        projectInfo.put("id", project.getId());
        projectInfo.put("name", project.getName());

        Map<String, Object> taskInfo = new LinkedHashMap<>();
        taskInfo.put("id", task.getId());
        taskInfo.put("finishedAt", task.getFinishedAt() == null ? null
                : task.getFinishedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        Map<String, Object> imageInfo = new LinkedHashMap<>();
        imageInfo.put("imageId", snapshot.imageId());
        imageInfo.put("datasetId", snapshot.datasetId());
        imageInfo.put("fileName", snapshot.originalFileName());
        imageInfo.put("subjectCode", snapshot.subjectCode());
        imageInfo.put("capturedAt", snapshot.capturedAt());
        String base = "/api/reports/projects/" + project.getId() + "/images/" + snapshot.imageId();
        imageInfo.put("correctedUrl", fileExists(task, snapshot)
                ? base + "/file?variant=corrected" : null);

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("project", projectInfo);
        report.put("task", taskInfo);
        report.put("image", imageInfo);
        report.put("regions", regions);
        report.put("legacy", resolved.legacy());
        return report;
    }

    public ReportFile readImage(Project project, String imageToken, String variant) {
        Task task = latestSuccessTask(project.getId());
        ResolvedImage resolved = resolveImage(task, imageToken);
        ImageSnapshot image = resolved.snapshot();
        String normalized = variant == null ? "corrected" : variant.toLowerCase(Locale.ROOT);
        if (!"corrected".equals(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "V1.0 single-image reports only provide the corrected image");
        }
        Path path = taskRoot(task).resolve("input").resolve(image.stagedFileName()).normalize();
        requireTaskPath(task, path);
        if (!Files.isRegularFile(path) || !Files.isReadable(path)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "corrected report image is unavailable");
        }
        return new ReportFile(path, MediaType.IMAGE_PNG,
                safeFilename(image.originalFileName()) + "-corrected.png");
    }

    public ReportFile exportPdf(Project project, String imageToken, String format) {
        if (format != null && !"pdf".equalsIgnoreCase(format)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "single image report only supports pdf");
        }
        Task task = latestSuccessTask(project.getId());
        ResolvedImage resolved = resolveImage(task, imageToken);
        Map<String, Object> report = getReport(project, resolved.snapshot().imageId());
        Path output = storageBaseDir.resolve("reports").resolve(project.getId())
                .resolve(task.getId()).resolve(resolved.snapshot().imageId() + ".pdf").normalize();
        try {
            Files.createDirectories(output.getParent());
            writePdf(output, task, resolved.snapshot(), report);
            return new ReportFile(output, MediaType.APPLICATION_PDF,
                    "单图分析报告-" + safeFilename(resolved.snapshot().originalFileName()) + ".pdf");
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "failed to generate single image PDF: " + safeMessage(ex));
        }
    }

    private void writePdf(Path output, Task task, ImageSnapshot image,
                          Map<String, Object> report) throws Exception {
        if (!Files.isRegularFile(pdfFontPath)) {
            throw new IllegalStateException("CJK PDF font is unavailable: " + pdfFontPath);
        }
        Path correctedPath = taskRoot(task).resolve("input").resolve(image.stagedFileName()).normalize();
        requireTaskPath(task, correctedPath);
        BufferedImage corrected = ImageIO.read(correctedPath.toFile());
        if (corrected == null) throw new IllegalStateException("corrected report image is invalid");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> regions = (List<Map<String, Object>>) report.get("regions");
        try (PDDocument document = new PDDocument();
             TrueTypeCollection collection = new TrueTypeCollection(pdfFontPath.toFile())) {
            TrueTypeFont ttf = firstCjkFont(collection);
            if (ttf == null) throw new IllegalStateException("no usable CJK font found");
            PDType0Font font = PDType0Font.load(document, ttf, true);

            PDPage cover = new PDPage(PDRectangle.A4);
            document.addPage(cover);
            try (PDPageContentStream content = new PDPageContentStream(document, cover)) {
                drawText(content, font, 18, 40, 805, "单张图片分析报告");
                drawText(content, font, 11, 40, 780,
                        "项目：" + String.valueOf(((Map<?, ?>) report.get("project")).get("name")));
                drawText(content, font, 11, 40, 762, "图片：" + image.originalFileName());
                drawText(content, font, 10, 40, 744,
                        "任务：" + String.valueOf(((Map<?, ?>) report.get("task")).get("id")));
                BufferedImage annotated = annotate(corrected, regions, null);
                drawImage(document, content, annotated, 40, 330, 515, 390);
                drawText(content, font, 10, 40, 305,
                        "已分析区域：" + regions.size() + "；仅展示客观颜色分布、主色像素数量与 HSV 熵值。");
            }

            for (Map<String, Object> region : regions) {
                PDPage page = new PDPage(PDRectangle.A4);
                document.addPage(page);
                try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                    String regionId = String.valueOf(region.get("regionId"));
                    drawText(content, font, 16, 40, 805,
                            "区域：" + String.valueOf(region.get("name")) + "（" + regionId + "）");
                    BufferedImage annotated = annotate(corrected, regions, regionId);
                    drawImage(document, content, annotated, 40, 500, 250, 270);
                    drawText(content, font, 11, 315, 770,
                            "有效像素：" + String.valueOf(region.get("validPixels")));
                    drawText(content, font, 11, 315, 746, "HSV 熵值");
                    Map<?, ?> entropy = (Map<?, ?>) region.get("entropy");
                    drawText(content, font, 10, 315, 726, "H：" + formatNumber(entropy.get("h")));
                    drawText(content, font, 10, 315, 708, "S：" + formatNumber(entropy.get("s")));
                    drawText(content, font, 10, 315, 690, "V：" + formatNumber(entropy.get("v")));

                    drawText(content, font, 12, 40, 470, "颜色分布");
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> colors = (List<Map<String, Object>>) region.get("colorDistribution");
                    drawBars(content, font, colors, true, 40, 445, 500);

                    drawText(content, font, 12, 40, 245, "主色像素数量");
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> mainColors = (List<Map<String, Object>>) region.get("mainColorNumber");
                    drawBars(content, font, mainColors, false, 40, 220, 500);
                }
            }
            document.save(output.toFile());
        }
    }

    private void drawBars(PDPageContentStream content, PDType0Font font,
                          List<Map<String, Object>> values, boolean ratioMode,
                          float x, float y, float width) throws Exception {
        List<Map<String, Object>> visible = values.stream()
                .filter(item -> longValue(item.get("count")) > 0)
                .sorted((a, b) -> Long.compare(longValue(b.get("count")), longValue(a.get("count"))))
                .limit(8).toList();
        long max = visible.stream().mapToLong(item -> longValue(item.get("count"))).max().orElse(1);
        float rowY = y;
        for (Map<String, Object> item : visible) {
            Color color = parseColor(String.valueOf(item.get("color")));
            content.setNonStrokingColor(color);
            float barWidth = Math.max(1, width * longValue(item.get("count")) / max);
            content.addRect(x + 110, rowY - 2, barWidth * 0.68f, 10);
            content.fill();
            content.setNonStrokingColor(Color.DARK_GRAY);
            drawText(content, font, 9, x, rowY, String.valueOf(item.get("label")));
            String suffix = ratioMode
                    ? String.format(Locale.ROOT, "%.2f%%", doubleValue(item.get("ratio")) * 100)
                    : String.valueOf(item.get("count"));
            drawText(content, font, 9, x + 460, rowY, suffix);
            rowY -= 22;
        }
        if (visible.isEmpty()) drawText(content, font, 9, x, rowY, "暂无有效数据");
    }

    private BufferedImage annotate(BufferedImage source, List<Map<String, Object>> regions,
                                   String selectedRegionId) {
        BufferedImage output = new BufferedImage(source.getWidth(), source.getHeight(),
                BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = output.createGraphics();
        graphics.drawImage(source, 0, 0, null);
        graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        graphics.setStroke(new BasicStroke(Math.max(2, source.getWidth() / 350f)));
        for (Map<String, Object> region : regions) {
            String regionId = String.valueOf(region.get("regionId"));
            boolean selected = selectedRegionId == null || selectedRegionId.equals(regionId);
            graphics.setColor(selected ? new Color(22, 119, 255, 230) : new Color(150, 150, 150, 130));
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> polygon = (List<Map<String, Object>>) region.get("polygon");
            if (polygon == null || polygon.size() < 3) continue;
            int[] xs = new int[polygon.size()];
            int[] ys = new int[polygon.size()];
            for (int i = 0; i < polygon.size(); i++) {
                xs[i] = (int) Math.round(doubleValue(polygon.get(i).get("x")) * source.getWidth());
                ys[i] = (int) Math.round(doubleValue(polygon.get(i).get("y")) * source.getHeight());
            }
            graphics.drawPolygon(xs, ys, polygon.size());
        }
        graphics.dispose();
        return output;
    }

    private void drawImage(PDDocument document, PDPageContentStream content, BufferedImage image,
                           float x, float y, float maxWidth, float maxHeight) throws Exception {
        float scale = Math.min(maxWidth / image.getWidth(), maxHeight / image.getHeight());
        float width = image.getWidth() * scale;
        float height = image.getHeight() * scale;
        BufferedImage embedded = resizeForPdf(image,
                Math.max(1, Math.round(maxWidth * 2)),
                Math.max(1, Math.round(maxHeight * 2)));
        PDImageXObject pdfImage = JPEGFactory.createFromImage(document, embedded, 0.82f);
        content.drawImage(pdfImage, x + (maxWidth - width) / 2, y + (maxHeight - height) / 2,
                width, height);
    }

    private BufferedImage resizeForPdf(BufferedImage source, int maxWidth, int maxHeight) {
        double scale = Math.min(1d, Math.min((double) maxWidth / source.getWidth(),
                (double) maxHeight / source.getHeight()));
        if (scale >= 1d) return source;
        int width = Math.max(1, (int) Math.round(source.getWidth() * scale));
        int height = Math.max(1, (int) Math.round(source.getHeight() * scale));
        BufferedImage resized = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = resized.createGraphics();
        graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION,
                RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        graphics.setRenderingHint(RenderingHints.KEY_RENDERING,
                RenderingHints.VALUE_RENDER_QUALITY);
        graphics.drawImage(source, 0, 0, width, height, null);
        graphics.dispose();
        return resized;
    }

    private void drawText(PDPageContentStream content, PDType0Font font, float size,
                          float x, float y, String value) throws Exception {
        content.beginText();
        content.setFont(font, size);
        content.newLineAtOffset(x, y);
        content.showText(value == null ? "" : value);
        content.endText();
    }

    private TrueTypeFont firstCjkFont(TrueTypeCollection collection) throws Exception {
        for (String name : List.of("WenQuanYiZenHei", "WenQuanYi Zen Hei",
                "NotoSansCJKsc-Regular", "NotoSansSC-Regular")) {
            TrueTypeFont font = collection.getFontByName(name);
            if (font != null) return font;
        }
        final TrueTypeFont[] first = new TrueTypeFont[1];
        collection.processAllFonts(font -> {
            if (first[0] == null) first[0] = font;
        });
        return first[0];
    }

    private ResolvedImage resolveImage(Task task, String imageToken) {
        if (imageToken == null || imageToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "report image not found");
        }
        List<ImageSnapshot> snapshots = snapshots(task);
        List<ImageSnapshot> idMatches = snapshots.stream()
                .filter(item -> imageToken.equals(item.imageId())).toList();
        if (idMatches.size() == 1) return new ResolvedImage(idMatches.get(0), false);

        List<ImageSnapshot> nameMatches = snapshots.stream()
                .filter(item -> imageToken.equals(item.originalFileName())
                        || imageToken.equals(item.stagedFileName())).toList();
        if (nameMatches.size() > 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "image name is ambiguous; use imageId");
        }
        if (nameMatches.size() == 1) return new ResolvedImage(nameMatches.get(0), true);

        if (snapshots.isEmpty()) {
            Set<String> csvNames = new LinkedHashSet<>();
            resultFiles(task).values().stream().findFirst()
                    .ifPresent(path -> readCsvSafe(path).forEach(row -> {
                        String name = row.get("image_name");
                        if (name != null && !name.isBlank()) csvNames.add(name);
                    }));
            if (csvNames.contains(imageToken)) {
                return new ResolvedImage(new ImageSnapshot(imageToken, "", imageToken, imageToken,
                        null, null, List.of()), true);
            }
        }
        throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                "image is not included in the latest successful task");
    }

    private List<ImageSnapshot> snapshots(Task task) {
        List<ImageSnapshot> snapshots = snapshotsFromParams(task);
        if (!snapshots.isEmpty()) return snapshots;
        return snapshotsFromResult(task);
    }

    private List<ImageSnapshot> snapshotsFromParams(Task task) {
        try {
            JsonNode images = objectMapper.readTree(task.getParams()).path("analysisPlan").path("images");
            return parseSnapshots(images);
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private List<ImageSnapshot> snapshotsFromResult(Task task) {
        try {
            JsonNode images = objectMapper.readTree(task.getResult()).path("imageManifest");
            return parseSnapshots(images);
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private List<ImageSnapshot> parseSnapshots(JsonNode images) {
        if (!images.isArray()) return List.of();
        List<ImageSnapshot> result = new ArrayList<>();
        images.forEach(image -> {
            List<RegionSnapshot> regions = new ArrayList<>();
            JsonNode rawRegions = image.path("regions");
            if (rawRegions.isArray()) {
                rawRegions.forEach(region -> {
                    List<Map<String, Double>> polygon = new ArrayList<>();
                    JsonNode rawPolygon = region.path("polygon");
                    if (rawPolygon.isArray()) {
                        rawPolygon.forEach(point -> polygon.add(Map.of(
                                "x", point.path("x").asDouble(),
                                "y", point.path("y").asDouble())));
                    }
                    regions.add(new RegionSnapshot(region.path("regionId").asText(),
                            region.path("name").asText(region.path("regionId").asText()), polygon));
                });
            }
            result.add(new ImageSnapshot(
                    image.path("imageId").asText(),
                    image.path("datasetId").asText(),
                    image.path("originalFileName").asText(image.path("imageId").asText()),
                    image.path("fileName").asText(),
                    nullableText(image.get("subjectCode")),
                    nullableText(image.get("capturedAt")),
                    regions));
        });
        return result;
    }

    private List<Map<String, String>> requiredCsv(Map<String, String> files, String key,
                                                   boolean legacy) {
        String path = files.get(key);
        List<Map<String, String>> rows = readCsvSafe(path);
        if (!legacy && rows.isEmpty()) {
            throw unprocessable("required report output is missing: " + key);
        }
        return rows;
    }

    private Map<String, Map<String, String>> rowsByRegion(List<Map<String, String>> rows,
                                                          String stagedFileName) {
        Map<String, Map<String, String>> result = new LinkedHashMap<>();
        rows.stream().filter(row -> stagedFileName.equals(row.get("image_name")))
                .forEach(row -> result.put(row.getOrDefault("region_id", ""), row));
        return result;
    }

    private List<RegionSnapshot> legacyRegions(Map<String, Map<String, String>>... maps) {
        Map<String, RegionSnapshot> result = new LinkedHashMap<>();
        for (Map<String, Map<String, String>> map : maps) {
            map.forEach((regionId, row) -> result.putIfAbsent(regionId,
                    new RegionSnapshot(regionId, row.getOrDefault("region_alias", regionId), List.of())));
        }
        return new ArrayList<>(result.values());
    }

    static List<Map<String, Object>> metricItems(Map<String, String> row, long validPixels,
                                                  boolean includeRatio) {
        if (row == null) return List.of();
        List<Map<String, Object>> result = new ArrayList<>();
        row.forEach((key, value) -> {
            if (FIXED_COLUMNS.contains(key)) return;
            long count = longValue(value);
            ColorInfo info = COLORS.getOrDefault(key, new ColorInfo(labelFor(key), "#8c8c8c"));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("key", key);
            item.put("label", info.label());
            item.put("count", count);
            if (includeRatio) item.put("ratio", validPixels == 0 ? 0d : (double) count / validPixels);
            item.put("color", info.hex());
            result.add(item);
        });
        return result;
    }

    private Map<String, Object> entropyValues(Map<String, String> row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("h", nullableDouble(row == null ? null : row.get("H_entropy")));
        result.put("s", nullableDouble(row == null ? null : row.get("S_entropy")));
        result.put("v", nullableDouble(row == null ? null : row.get("V_entropy")));
        return result;
    }

    private Map<String, String> resultFiles(Task task) {
        if (task.getResult() == null || task.getResult().isBlank()) return Map.of();
        try {
            JsonNode files = objectMapper.readTree(task.getResult()).path("files");
            if (!files.isObject()) return Map.of();
            Map<String, String> result = new LinkedHashMap<>();
            files.fields().forEachRemaining(entry -> result.put(entry.getKey(), entry.getValue().asText()));
            return result;
        } catch (Exception ex) {
            return Map.of();
        }
    }

    private List<Map<String, String>> readCsvSafe(String rawPath) {
        if (rawPath == null || rawPath.isBlank()) return List.of();
        Path path = Paths.get(rawPath).toAbsolutePath().normalize();
        if (!path.startsWith(storageBaseDir) || !Files.isRegularFile(path)) return List.of();
        try (Reader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8);
             CSVParser parser = CSVFormat.DEFAULT.builder().setHeader()
                     .setSkipHeaderRecord(true).build().parse(reader)) {
            List<Map<String, String>> rows = new ArrayList<>();
            for (CSVRecord record : parser) {
                Map<String, String> row = new LinkedHashMap<>();
                parser.getHeaderMap().keySet().forEach(header -> row.put(header, record.get(header)));
                rows.add(row);
            }
            return rows;
        } catch (Exception ex) {
            return List.of();
        }
    }

    private Task latestSuccessTask(String projectId) {
        return taskRepository.findTopByProjectIdAndStatusOrderByCreatedAtDesc(projectId, "success")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                        "project has no successful analysis task"));
    }

    private Path taskRoot(Task task) {
        return storageBaseDir.resolve("projects").resolve(task.getProjectId())
                .resolve(task.getId()).toAbsolutePath().normalize();
    }

    private void requireTaskPath(Task task, Path path) {
        if (!path.toAbsolutePath().normalize().startsWith(taskRoot(task))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid report file path");
        }
    }

    private boolean fileExists(Task task, ImageSnapshot image) {
        return Files.isRegularFile(
                taskRoot(task).resolve("input").resolve(image.stagedFileName()));
    }

    private static Map<String, ColorInfo> colorDefinitions() {
        Map<String, ColorInfo> result = new HashMap<>();
        result.put("red", new ColorInfo("红色", "#f5222d"));
        result.put("orange", new ColorInfo("橙色", "#fa8c16"));
        result.put("yellow", new ColorInfo("黄色", "#fadb14"));
        result.put("lemon_yellow", new ColorInfo("柠檬黄", "#fff566"));
        result.put("yellow_green", new ColorInfo("黄绿色", "#a0d911"));
        result.put("green", new ColorInfo("绿色", "#52c41a"));
        result.put("blue", new ColorInfo("蓝色", "#1677ff"));
        result.put("dark_blue", new ColorInfo("深蓝色", "#10239e"));
        result.put("blue_purple", new ColorInfo("蓝紫色", "#531dab"));
        result.put("purple", new ColorInfo("紫色", "#722ed1"));
        result.put("brown", new ColorInfo("棕色", "#873800"));
        result.put("gray", new ColorInfo("灰色", "#8c8c8c"));
        result.put("gray_white", new ColorInfo("灰白色", "#bfbfbf"));
        result.put("black", new ColorInfo("黑色", "#262626"));
        result.put("white", new ColorInfo("白色", "#f5f5f5"));
        result.put("uncategorized", new ColorInfo("未分类", "#d9d9d9"));
        return result;
    }

    private static String labelFor(String key) {
        return key == null ? "未知" : key.replace('_', ' ');
    }

    private static long longValue(Object value) {
        if (value instanceof Number number) return number.longValue();
        try {
            return value == null || String.valueOf(value).isBlank()
                    ? 0L : Math.round(Double.parseDouble(String.valueOf(value)));
        } catch (Exception ex) {
            return 0L;
        }
    }

    private static double doubleValue(Object value) {
        if (value instanceof Number number) return number.doubleValue();
        try {
            return value == null ? 0d : Double.parseDouble(String.valueOf(value));
        } catch (Exception ex) {
            return 0d;
        }
    }

    private Double nullableDouble(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Double.parseDouble(value);
        } catch (Exception ex) {
            return null;
        }
    }

    private String nullableText(JsonNode node) {
        return node == null || node.isNull() || node.asText().isBlank() ? null : node.asText();
    }

    private String formatNumber(Object value) {
        return value == null ? "—" : String.format(Locale.ROOT, "%.4f", doubleValue(value));
    }

    private Color parseColor(String value) {
        try {
            return Color.decode(value);
        } catch (Exception ex) {
            return Color.GRAY;
        }
    }

    private String safeFilename(String raw) {
        String value = raw == null || raw.isBlank() ? "image" : raw;
        return value.replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_");
    }

    private String safeMessage(Exception ex) {
        return ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage();
    }

    private ResponseStatusException unprocessable(String message) {
        return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message);
    }

    public record ReportFile(Path path, MediaType mediaType, String filename) {}

    private record ColorInfo(String label, String hex) {}

    private record RegionSnapshot(String regionId, String name,
                                  List<Map<String, Double>> polygon) {}

    private record ImageSnapshot(String imageId, String datasetId, String originalFileName,
                                 String stagedFileName, String subjectCode,
                                 String capturedAt, List<RegionSnapshot> regions) {}

    private record ResolvedImage(ImageSnapshot snapshot, boolean legacy) {}
}
