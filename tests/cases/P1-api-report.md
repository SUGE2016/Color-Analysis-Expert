# P1 报告 API

**前置：** PRJ-04、PRJ-05 已成功（存在 `success` 任务与结果文件）。

| ID | 场景 | 步骤 | 期望 | 状态 |
|----|------|------|------|------|
| RPT-01 | 汇总报告 | `GET /api/reports/projects/{projectId}/summary` | 200；`images` 返回成功 Task 中全部已配置图片及稳定 `imageId`，不受 preview 20 行限制 | PASS |
| RPT-02 | 单图报告 | `GET /api/reports/projects/{projectId}/images/{imageId}` | 200；按 imageId + regionId 合并颜色分布、主色像素数量、HSV 熵值与区域多边形；不含样本标签、原图 URL、边缘/面积/线条结果 | PASS |
| RPT-03 | 导出 CSV/PDF | 分别以 `format=csv`、`format=pdf` 调用导出接口 | 均返回 200 与可下载文件流 | PASS |
| RPT-04 | 未 run 项目 | 对 `created` 状态项目调 RPT-01 | 409，提示尚无成功分析任务 | PASS |
| RPT-05 | 单图图片快照 | 请求 `file?variant=corrected` 和 `file?variant=original`，并检查 Task 目录与快照字段 | corrected 返回 Task 矫正图；original 返回 400；新 Task 不生成 `original/` 且不保存样本 `label`；非 owner 返回 403 | PASS |
| RPT-06 | 单图 PDF 与错误契约 | 导出 `format=pdf`；再请求 `format=csv` 和未配置 imageId | PDF 非空且以 `%PDF` 开头；CSV 返回 400；未配置图片返回 404 | PASS |
| RPT-07 | 报告指标单元测试 | 在 Maven Docker 容器运行 `SingleImageReportServiceTests` | 颜色计数与比例、零像素、未分类颜色和主色像素语义 3/3 PASS | PASS |

## 执行记录

| 执行人 | 日期 | 通过/总数 | 备注 |
|--------|------|-----------|------|
| Agent | 2026-06-24 | 2/4 (2 SKIP) | RPT-02/03 需要实际运行的项目数据 |
| Codex | 2026-07-21 | 4/4 | 汇总、单图、CSV/PDF 导出和未 run 约定均通过 |
| Codex | 2026-07-24 | 6/6（本次范围） | RPT-01/02/04/05/06 Docker 闭环及 RPT-07 单元测试通过；RPT-02/05 已按精简契约复测 |
