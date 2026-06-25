# P1 分析项目 API

**前置：**

- AUTH-01、`TOKEN`
- DS-01 + DS-05（至少 1 个数据集且含图片）
- TPL-01（可选；`templateId` 可 null 则跳过）

| ID | 场景 | 步骤 | 期望 | 状态 |
|----|------|------|------|------|
| PRJ-01 | 创建项目 | `POST /api/projects` 绑定 datasetId | 200，`status` 为 `created` | 待测 |
| PRJ-02 | 列表项目 | `GET /api/projects` | 200，含 PRJ-01 | 待测 |
| PRJ-03 | 单个项目 | `GET /api/projects/{id}` | 200 | 待测 |
| PRJ-04 | 执行分析 | `POST /api/projects/{id}/run` body 含 steps、模型路径等（见 APIdoc） | 200 或业务约定；项目最终 `completed` 或任务 `success` | 待测 |
| PRJ-05 | 查询任务 | `GET /api/projects/{id}/tasks` | 200，含 PRJ-04 任务记录 | 待测 |
| PRJ-06 | 无数据 run | 空数据集上 run | `failed` 或明确 4xx/错误信息（记录实际） | 待测 |
| PRJ-07 | 无 token | `POST /api/projects` 无 Authorization | 401/403 | 待测 |

## PRJ-04 说明

- 为**同步 MVP**，可能耗时较长（>30s），执行时记录实际耗时
- `modelImagePath` / `butterflyJsonPath` / `edgeJsonPath` 建议使用仓库内路径或容器内挂载路径；Docker 环境需在请求体中使用 API 可读路径（按 `ProjectAnalysisService` 实测填写）

参考：`backend/APIdoc/project-analysis-api.md`

## 执行记录

| 执行人 | 日期 | 通过/总数 | 备注 |
|--------|------|-----------|------|
| | | /7 | |
