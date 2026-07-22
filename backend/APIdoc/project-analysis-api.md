# 项目分析 API

## 1. 契约概览

- 所有接口需要 `Authorization: Bearer <token>`。
- 项目 owner 始终取自 JWT，客户端传入的 `ownerId` 会被忽略。
- 项目支持多个 `datasetIds`，且 `templateId` 必填。
- 创建后为 `draft`；向导每一步通过 `PUT` 持续保存配置。
- `/run` 为异步接口，只接受分析步骤，不接受任何服务器文件路径。
- 涂色面积分析不在本期范围内。

## 2. 状态机

Project：`draft -> queued -> running -> completed | failed | cancelled`

Task：`queued -> running -> success | failed | cancelled`

Task 同时返回 `progress`、`currentStep`、`startedAt`、`finishedAt`、`logs`。取消中的运行任务会在流水线边界结束为 `cancelled`；已产生的中间文件仅用于诊断，不开放正式报告。

## 3. 创建项目草稿

`POST /api/projects`

```json
{
  "name": "项目A",
  "datasetIds": ["dataset-uuid-1", "dataset-uuid-2"],
  "templateId": "template-uuid",
  "config": {
    "description": "示例",
    "currentStep": 0,
    "edgeAnalysisEnabled": false
  }
}
```

成功返回 HTTP 200。返回对象包含真实项目 ID、`datasetIds`、`templateSnapshot`、`createdAt` 和 `updatedAt`。同一 owner 下项目名重复返回 409；数据集、模板或模板资源无效返回 422；引用其他用户数据集返回 403。

## 4. 持续保存草稿

`PUT /api/projects/{projectId}`

```json
{
  "name": "项目A",
  "datasetIds": ["dataset-uuid-1", "dataset-uuid-2"],
  "templateId": "template-uuid",
  "config": {
    "currentStep": 3,
    "regions": [],
    "imageAnalysisConfig": {},
    "edgeAnalysisEnabled": false
  }
}
```

仅 owner 可更新。`queued` 或 `running` 项目不可编辑，返回 409。

## 5. 异步运行

`POST /api/projects/{projectId}/run`

```json
{
  "steps": ["edge_hsv", "edge_color"]
}
```

后端固定执行基础步骤 `correction`、`hsv`、`entropy`、`main_color`、`main_color_number`；启用出界/边缘分析时追加 `edge_hsv`、`edge_color`。模板图片由项目模板快照推导，区域定义仅来自项目步骤 3 持久化的 `config.regions`；数据集输入目录和任务工作区均由后端推导。`config.regions` 为空或格式无效时，`/run` 在创建 Task 前返回 422。

成功受理返回 HTTP 202 和 Task（同时提供 `id` 与 `taskId`），并通过 `Location: /api/tasks/{taskId}` 指向查询接口。空数据集返回 422，且不会创建 Task。存在活动 Task 时重复运行返回 409。请求包含 `modelImagePath`、`butterflyJsonPath` 或 `edgeJsonPath` 时返回 400。

成功任务必须产生非空的：

- `mainColorCsv`
- `mainColorNumberCsv`
- `entropyCsv`
- `edgeColorCsv`（仅启用边缘/出界分析时必需）

缺少必需输出会把 Task 和 Project 标记为 `failed`。

## 6. 查询与取消

- `GET /api/projects`：只返回当前用户项目。
- `GET /api/projects/{id}`：项目详情及模板快照。
- `GET /api/projects/{id}/tasks`：任务列表，最新任务在前。
- `GET /api/tasks/{taskId}`：真实任务状态和进度。
- `POST /api/projects/{id}/cancel`：取消最新的 queued/running Task。
- `POST /api/projects/{id}/stop`：`cancel` 的兼容别名。
- `DELETE /api/projects/{id}`：删除无活动任务的项目及其 Task。

详情、更新、运行、取消、任务查询和删除均校验 owner；跨用户访问返回 403，资源不存在返回 404。
