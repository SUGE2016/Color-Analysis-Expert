# 项目分析 API

## 1. 契约概览

- 所有接口需要 `Authorization: Bearer <token>`。
- 项目 owner 始终取自 JWT，客户端传入的 `ownerId` 会被忽略。
- 项目支持多个 `datasetIds`，且 `templateId` 必填。
- 创建后为 `draft`；向导每一步通过 `PUT` 持续保存配置。
- 第二步矫正结果持久化在项目草稿工作区，刷新后可恢复，最终任务复用同一文件。
- `/run` 为异步接口，请求体为空；分析步骤由项目配置推导，不接受客户端步骤或服务器文件路径。
- V1.0 唯一可执行方法为 `color_distribution`，固定产出熵值、主色、主色数量；出界与面积分析不执行。
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
    "analysisConfigVersion": 1,
    "regions": [],
    "imageAnalysisConfig": {}
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
    "analysisConfigVersion": 1,
    "imageAnalysisConfig": {
      "image-uuid": {
        "region-1": ["color_distribution"]
      }
    }
  }
}
```

仅 owner 可更新。`queued` 或 `running` 项目不可编辑，返回 409。

## 5. 项目级同步矫正

- `POST /api/projects/{projectId}/corrections/{imageId}`：根据项目模板和图片同步矫正，保存后返回 `image/png`。
- `GET /api/projects/{projectId}/corrections`：列出项目图片的矫正状态与预览地址。
- `GET /api/projects/{projectId}/corrections/{imageId}/file`：读取已保存的矫正图片。

客户端只传项目 ID 和图片 ID。后端校验 owner、图片属于已选数据集、模板快照和文件均可读。结果保存到 `projects/{projectId}/draft/corrected/{imageId}.png`；数据集或模板变化以及项目删除时清理。

## 6. 异步运行

`POST /api/projects/{projectId}/run`

请求体为空或 `{}`。

后端从 `config.imageAnalysisConfig` 规范化出实际图片/区域执行清单，只处理配置了 `color_distribution` 的图片和区域，并固定执行 `hsv`、`entropy`、`main_color`、`main_color_number`。Task `params.analysisPlan` 保存不可变快照。区域只来自步骤 3 的 `config.regions`；缺少区域、方法、矫正文件，或出现 `boundary_check`/未知方法时，在创建 Task 前返回 422。

成功受理返回 HTTP 202 和 Task，并通过 `Location: /api/tasks/{taskId}` 指向查询接口。存在活动 Task 时重复运行返回 409。请求包含 `steps`、`modelImagePath`、`butterflyJsonPath` 或 `edgeJsonPath` 时返回 422。

成功任务必须产生非空的：

- `mainColorCsv`
- `mainColorNumberCsv`
- `entropyCsv`

缺少必需输出会把 Task 和 Project 标记为 `failed`。

## 7. 查询与取消

- `GET /api/projects`：只返回当前用户项目。
- `GET /api/projects/{id}`：项目详情及模板快照。
- `GET /api/projects/{id}/tasks`：任务列表，最新任务在前。
- `GET /api/tasks/{taskId}`：真实任务状态和进度。
- `POST /api/projects/{id}/cancel`：取消最新的 queued/running Task。
- `POST /api/projects/{id}/stop`：`cancel` 的兼容别名。
- `DELETE /api/projects/{id}`：删除无活动任务的项目及其 Task。

详情、更新、运行、取消、任务查询和删除均校验 owner；跨用户访问返回 403，资源不存在返回 404。
