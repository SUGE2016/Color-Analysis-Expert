package com.coloranalysisbackend.controller;

import com.coloranalysisbackend.model.Project;
import com.coloranalysisbackend.service.ReportService;
import com.coloranalysisbackend.service.ProjectAnalysisService;
import com.coloranalysisbackend.service.SingleImageReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ContentDisposition;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
@Tag(name = "报告管理", description = "分析结果汇总、单图报告与导出")
public class ReportController {
    private final ReportService reportService;
    private final ProjectAnalysisService projectAnalysisService;
    private final SingleImageReportService singleImageReportService;

    public ReportController(ReportService reportService,
                            ProjectAnalysisService projectAnalysisService,
                            SingleImageReportService singleImageReportService) {
        this.reportService = reportService;
        this.projectAnalysisService = projectAnalysisService;
        this.singleImageReportService = singleImageReportService;
    }

    @GetMapping("/projects/{projectId}/summary")
    @Operation(summary = "查询项目汇总报告")
    public ResponseEntity<?> projectSummary(@PathVariable String projectId) {
        try {
            projectAnalysisService.getProject(projectId);
            Map<String, Object> summary = reportService.getProjectSummary(projectId);
            summary.put("images", singleImageReportService.listImages(projectId));
            return ResponseEntity.ok(summary);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @GetMapping("/projects/{projectId}/images/{imageId}")
    @Operation(summary = "查询单图明细报告")
    public ResponseEntity<?> singleImageReport(@PathVariable String projectId,
                                               @PathVariable String imageId) {
        Project project = projectAnalysisService.getProject(projectId);
        return ResponseEntity.ok(singleImageReportService.getReport(project, imageId));
    }

    @GetMapping("/projects/{projectId}/images/{imageId}/file")
    @Operation(summary = "读取单图报告图片快照")
    public ResponseEntity<?> singleImageFile(@PathVariable String projectId,
                                             @PathVariable String imageId,
                                             @RequestParam(defaultValue = "corrected") String variant) {
        Project project = projectAnalysisService.getProject(projectId);
        SingleImageReportService.ReportFile file =
                singleImageReportService.readImage(project, imageId, variant);
        return ResponseEntity.ok()
                .contentType(file.mediaType())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(file.filename(), StandardCharsets.UTF_8).build().toString())
                .body(new FileSystemResource(file.path()));
    }

    @GetMapping("/projects/{projectId}/images/{imageId}/export")
    @Operation(summary = "导出单图 PDF 报告")
    public ResponseEntity<?> exportSingleImage(@PathVariable String projectId,
                                               @PathVariable String imageId,
                                               @RequestParam(defaultValue = "pdf") String format) {
        Project project = projectAnalysisService.getProject(projectId);
        SingleImageReportService.ReportFile file =
                singleImageReportService.exportPdf(project, imageId, format);
        return ResponseEntity.ok()
                .contentType(file.mediaType())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(file.filename(), StandardCharsets.UTF_8).build().toString())
                .body(new FileSystemResource(file.path()));
    }

    @GetMapping("/projects/{projectId}/export")
    @Operation(summary = "导出项目报告", description = "支持csv、xlsx、pdf")
    public ResponseEntity<?> export(@PathVariable String projectId,
                                    @RequestParam(defaultValue = "csv") String format) {
        projectAnalysisService.getProject(projectId);
        try {
            File file = reportService.exportProjectSummary(projectId, format);
            String lowered = format.toLowerCase();
            MediaType contentType;
            switch (lowered) {
                case "xlsx":
                    contentType = MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                    break;
                case "pdf":
                    contentType = MediaType.APPLICATION_PDF;
                    break;
                default:
                    contentType = MediaType.parseMediaType("text/csv");
                    break;
            }

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + file.getName())
                    .contentType(contentType)
                    .body(new FileSystemResource(file));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.internalServerError().body(ex.getMessage());
        }
    }
}
