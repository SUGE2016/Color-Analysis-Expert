# P1 报告 API

**前置：** PRJ-04、PRJ-05 已成功（存在 `success` 任务与结果文件）。

| ID | 场景 | 步骤 | 期望 | 状态 |
|----|------|------|------|------|
| RPT-01 | 汇总报告 | `GET /api/reports/projects/{projectId}/summary` | 200，含 `projectId`、`availableFiles` 或 `stats` | PASS |
| RPT-02 | 单图报告 | `GET /api/reports/projects/{projectId}/images/{imageName}` | 200（imageName 取自数据集实际上传文件名） | PASS |
| RPT-03 | 导出 CSV/PDF | 分别以 `format=csv`、`format=pdf` 调用导出接口 | 均返回 200 与可下载文件流 | PASS |
| RPT-04 | 未 run 项目 | 对 `created` 状态项目调 RPT-01 | 404 或空数据（记录实际契约） | PASS |

## 执行记录

| 执行人 | 日期 | 通过/总数 | 备注 |
|--------|------|-----------|------|
| Agent | 2026-06-24 | 2/4 (2 SKIP) | RPT-02/03 需要实际运行的项目数据 |
| Codex | 2026-07-21 | 4/4 | 汇总、单图、CSV/PDF 导出和未 run 约定均通过 |
