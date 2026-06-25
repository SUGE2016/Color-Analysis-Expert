# P1 报告 API

**前置：** PRJ-04、PRJ-05 已成功（存在 `success` 任务与结果文件）。

| ID | 场景 | 步骤 | 期望 | 状态 |
|----|------|------|------|------|
| RPT-01 | 汇总报告 | `GET /api/reports/projects/{projectId}/summary` | 200，含 `projectId`、`availableFiles` 或 `stats` | 待测 |
| RPT-02 | 单图报告 | `GET /api/reports/projects/{projectId}/images/{imageName}` | 200（imageName 取自数据集实际上传文件名） | 待测 |
| RPT-03 | 导出 CSV | `GET /api/reports/projects/{projectId}/export?format=csv` | 200，可下载文件流 | 待测 |
| RPT-04 | 未 run 项目 | 对 `created` 状态项目调 RPT-01 | 404 或空数据（记录实际契约） | 待测 |

## 执行记录

| 执行人 | 日期 | 通过/总数 | 备注 |
|--------|------|-----------|------|
| | | /4 | |
