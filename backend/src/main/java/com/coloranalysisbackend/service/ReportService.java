package com.coloranalysisbackend.service;

import com.coloranalysisbackend.model.Task;
import com.coloranalysisbackend.repository.TaskRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ReportService {
    private final TaskRepository taskRepository;
    private final ObjectMapper objectMapper;
    private final String storageBaseDir;

    public ReportService(TaskRepository taskRepository,
                         ObjectMapper objectMapper,
                         @Value("${storage.base-dir}") String storageBaseDir) {
        this.taskRepository = taskRepository;
        this.objectMapper = objectMapper;
        this.storageBaseDir = storageBaseDir;
    }

    public Map<String, Object> getProjectSummary(String projectId) {
        Task task = getLatestSuccessTask(projectId);
        Map<String, String> files = extractFileMap(task.getResult());

        List<Map<String, String>> mainColorRows = readCsvSafe(files.get("mainColorCsv"));
        List<Map<String, String>> mainColorNumberRows = readCsvSafe(files.get("mainColorNumberCsv"));
        List<Map<String, String>> entropyRows = readCsvSafe(files.get("entropyCsv"));
        List<Map<String, String>> edgeColorRows = readCsvSafe(files.get("edgeColorCsv"));

        Set<String> imageNames = new HashSet<>();
        imageNames.addAll(extractImageNames(mainColorRows));
        imageNames.addAll(extractImageNames(mainColorNumberRows));
        imageNames.addAll(extractImageNames(entropyRows));
        imageNames.addAll(extractImageNames(edgeColorRows));

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("projectId", projectId);
        summary.put("taskId", task.getId());
        summary.put("taskCreatedAt", task.getCreatedAt() == null ? null : task.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        summary.put("availableFiles", files);

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("imageCount", imageNames.size());
        stats.put("mainColorRows", mainColorRows.size());
        stats.put("mainColorNumberRows", mainColorNumberRows.size());
        stats.put("entropyRows", entropyRows.size());
        stats.put("edgeColorRows", edgeColorRows.size());
        summary.put("stats", stats);

        Map<String, Object> preview = new LinkedHashMap<>();
        preview.put("mainColor", mainColorRows.stream().limit(20).collect(Collectors.toList()));
        preview.put("mainColorNumber", mainColorNumberRows.stream().limit(20).collect(Collectors.toList()));
        preview.put("entropy", entropyRows.stream().limit(20).collect(Collectors.toList()));
        preview.put("edgeColor", edgeColorRows.stream().limit(20).collect(Collectors.toList()));
        summary.put("preview", preview);

        return summary;
    }

    public Map<String, Object> getSingleImageReport(String projectId, String imageName) {
        Task task = getLatestSuccessTask(projectId);
        Map<String, String> files = extractFileMap(task.getResult());

        List<Map<String, String>> mainColorRows = filterByImageName(readCsvSafe(files.get("mainColorCsv")), imageName);
        List<Map<String, String>> mainColorNumberRows = filterByImageName(readCsvSafe(files.get("mainColorNumberCsv")), imageName);
        List<Map<String, String>> entropyRows = filterByImageName(readCsvSafe(files.get("entropyCsv")), imageName);
        List<Map<String, String>> edgeColorRows = filterByImageName(readCsvSafe(files.get("edgeColorCsv")), imageName);

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("projectId", projectId);
        detail.put("taskId", task.getId());
        detail.put("imageName", imageName);

        Map<String, Object> sections = new LinkedHashMap<>();
        sections.put("mainColor", mainColorRows);
        sections.put("mainColorNumber", mainColorNumberRows);
        sections.put("entropy", entropyRows);
        sections.put("edgeColor", edgeColorRows);
        detail.put("sections", sections);

        return detail;
    }

    public File exportProjectSummary(String projectId, String format) throws IOException {
        Task task = getLatestSuccessTask(projectId);
        List<Map<String, String>> unifiedRows = buildUnifiedRows(task);

        Path reportDir = Paths.get(storageBaseDir, "reports", projectId);
        Files.createDirectories(reportDir);

        String targetFormat = (format == null || format.isBlank()) ? "csv" : format.toLowerCase(Locale.ROOT);
        return switch (targetFormat) {
            case "xlsx" -> writeXlsx(reportDir.resolve("summary.xlsx"), unifiedRows);
            case "pdf" -> writePdf(reportDir.resolve("summary.pdf"), projectId, unifiedRows);
            default -> writeCsv(reportDir.resolve("summary.csv"), unifiedRows);
        };
    }

    private Task getLatestSuccessTask(String projectId) {
        return taskRepository.findTopByProjectIdAndStatusOrderByCreatedAtDesc(projectId, "success")
                .orElseThrow(() -> new IllegalArgumentException("no successful analysis task found for project"));
    }

    private Map<String, String> extractFileMap(String resultJson) {
        if (resultJson == null || resultJson.isBlank()) {
            return Map.of();
        }
        try {
            JsonNode root = objectMapper.readTree(resultJson);
            JsonNode filesNode = root.path("files");
            if (!filesNode.isObject()) {
                return Map.of();
            }
            Map<String, String> map = new LinkedHashMap<>();
            filesNode.fields().forEachRemaining(entry -> map.put(entry.getKey(), entry.getValue().asText()));
            return map;
        } catch (Exception e) {
            return Map.of();
        }
    }

    private List<String> extractImageNames(List<Map<String, String>> rows) {
        return rows.stream()
                .map(row -> row.getOrDefault("image_name", ""))
                .filter(name -> !name.isBlank())
                .distinct()
                .collect(Collectors.toList());
    }

    private List<Map<String, String>> filterByImageName(List<Map<String, String>> rows, String imageName) {
        return rows.stream()
                .filter(row -> imageName.equals(row.get("image_name")))
                .collect(Collectors.toList());
    }

    private List<Map<String, String>> readCsvSafe(String pathStr) {
        if (pathStr == null || pathStr.isBlank()) {
            return List.of();
        }
        Path path = Paths.get(pathStr);
        if (!Files.exists(path)) {
            return List.of();
        }
        try (Reader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8);
             CSVParser parser = CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).build().parse(reader)) {
            List<Map<String, String>> rows = new ArrayList<>();
            for (CSVRecord record : parser) {
                Map<String, String> row = new LinkedHashMap<>();
                for (String header : parser.getHeaderMap().keySet()) {
                    row.put(header, record.get(header));
                }
                rows.add(row);
            }
            return rows;
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<Map<String, String>> buildUnifiedRows(Task task) {
        Map<String, String> files = extractFileMap(task.getResult());
        List<Map<String, String>> mainColorRows = readCsvSafe(files.get("mainColorCsv"));
        List<Map<String, String>> mainColorNumberRows = readCsvSafe(files.get("mainColorNumberCsv"));
        List<Map<String, String>> entropyRows = readCsvSafe(files.get("entropyCsv"));

        Map<String, Map<String, String>> merged = new LinkedHashMap<>();

        for (Map<String, String> row : mainColorRows) {
            String key = buildKey(row);
            merged.putIfAbsent(key, new LinkedHashMap<>());
            merged.get(key).putAll(row);
        }

        for (Map<String, String> row : mainColorNumberRows) {
            String key = buildKey(row);
            merged.putIfAbsent(key, new LinkedHashMap<>());
            row.forEach((k, v) -> merged.get(key).put("mc_num_" + k, v));
        }

        for (Map<String, String> row : entropyRows) {
            String key = buildKey(row);
            merged.putIfAbsent(key, new LinkedHashMap<>());
            row.forEach((k, v) -> merged.get(key).put("entropy_" + k, v));
        }

        return new ArrayList<>(merged.values());
    }

    private String buildKey(Map<String, String> row) {
        return row.getOrDefault("image_name", "") + "|"
                + row.getOrDefault("region_id", "") + "|"
                + row.getOrDefault("region_alias", "");
    }

    private File writeCsv(Path output, List<Map<String, String>> rows) throws IOException {
        try (Writer writer = Files.newBufferedWriter(output, StandardCharsets.UTF_8)) {
            if (rows.isEmpty()) {
                writer.write("\n");
            } else {
                List<String> headers = new ArrayList<>(rows.get(0).keySet());
                try (CSVPrinter printer = new CSVPrinter(writer, CSVFormat.DEFAULT.builder().setHeader(headers.toArray(new String[0])).build())) {
                    for (Map<String, String> row : rows) {
                        List<String> values = headers.stream().map(h -> row.getOrDefault(h, "")).collect(Collectors.toList());
                        printer.printRecord(values);
                    }
                }
            }
        }
        return output.toFile();
    }

    private File writeXlsx(Path output, List<Map<String, String>> rows) throws IOException {
        try (XSSFWorkbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("summary");
            if (!rows.isEmpty()) {
                List<String> headers = new ArrayList<>(rows.get(0).keySet());
                Row headerRow = sheet.createRow(0);
                for (int i = 0; i < headers.size(); i++) {
                    headerRow.createCell(i).setCellValue(headers.get(i));
                }
                for (int r = 0; r < rows.size(); r++) {
                    Row row = sheet.createRow(r + 1);
                    Map<String, String> data = rows.get(r);
                    for (int c = 0; c < headers.size(); c++) {
                        row.createCell(c).setCellValue(data.getOrDefault(headers.get(c), ""));
                    }
                }
            }
            try (OutputStream os = Files.newOutputStream(output)) {
                workbook.write(os);
            }
        }
        return output.toFile();
    }

    private File writePdf(Path output, String projectId, List<Map<String, String>> rows) throws IOException {
        try (PDDocument document = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            PDPageContentStream content = new PDPageContentStream(document, page);
            content.beginText();
            content.setFont(PDType1Font.HELVETICA, 10);
            content.setLeading(14f);
            content.newLineAtOffset(40, 800);
            content.showText("Project Summary Report - " + projectId);
            content.newLine();
            content.newLine();

            int lineCount = 0;
            for (Map<String, String> row : rows) {
                String line = row.entrySet().stream()
                        .map(e -> e.getKey() + "=" + e.getValue())
                        .collect(Collectors.joining(" | "));
                if (line.length() > 160) {
                    line = line.substring(0, 160) + "...";
                }
                content.showText(line);
                content.newLine();
                lineCount++;
                if (lineCount > 48) {
                    content.endText();
                    content.close();
                    page = new PDPage(PDRectangle.A4);
                    document.addPage(page);
                    content = new PDPageContentStream(document, page);
                    content.beginText();
                    content.setFont(PDType1Font.HELVETICA, 10);
                    content.setLeading(14f);
                    content.newLineAtOffset(40, 800);
                    lineCount = 0;
                }
            }

            content.endText();
            content.close();
            document.save(output.toFile());
        }
        return output.toFile();
    }
}
