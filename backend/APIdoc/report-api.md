# 分析报告与结果展示模块接口文档

## 模块说明

该模块实现需求文档中的“分析报告与结果展示”：

1. 项目级汇总报告查询（全局汇总）
2. 单张图片明细报告查询（钻取）
3. 报告导出（CSV / XLSX / PDF）

## 主要由哪些文件构成

- `src/main/java/com/coloranalysisbackend/service/ReportService.java`
  - 读取项目最新成功任务的结果文件
  - 组装汇总数据、单图数据
  - 导出 CSV/XLSX/PDF
- `src/main/java/com/coloranalysisbackend/controller/ReportController.java`
  - 对外提供 REST 接口
- `src/main/java/com/coloranalysisbackend/repository/TaskRepository.java`
  - 查询项目最近成功任务
- `src/main/java/com/coloranalysisbackend/model/Task.java`
  - 持有任务结果 JSON（含结果文件路径）

与项目分析模块联动文件：

- `src/main/java/com/coloranalysisbackend/service/ProjectAnalysisService.java`
- `color-analysis-python/app_http.py`

## 接口列表

### 1) 获取项目全局汇总报告

`GET /api/reports/projects/{projectId}/summary`

**说明**
- 返回该项目最近一次 `success` 任务的汇总信息
- 包含可用结果文件、统计计数、预览数据（前20行）

**成功响应示例**
```json
{
  "projectId": "...",
  "taskId": "...",
  "taskCreatedAt": "2026-03-18T21:10:00",
  "availableFiles": {
    "mainColorCsv": ".../main_color.csv",
    "mainColorNumberCsv": ".../main_color_number.csv",
    "entropyCsv": ".../image_entropy_region_results.csv"
  },
  "stats": {
    "imageCount": 32,
    "mainColorRows": 680,
    "mainColorNumberRows": 680,
    "entropyRows": 680,
    "edgeColorRows": 0
  },
  "preview": {
    "mainColor": [ ... ],
    "mainColorNumber": [ ... ],
    "entropy": [ ... ],
    "edgeColor": [ ... ]
  }
}
```

### 2) 获取单张图片明细报告（钻取）

`GET /api/reports/projects/{projectId}/images/{imageName}`

**说明**
- 按 `image_name` 过滤该图片的全部分区结果
- 返回主色统计、颜色种类统计、熵、边缘色彩等分节

**成功响应示例**
```json
{
  "projectId": "...",
  "taskId": "...",
  "imageName": "sample_001.png",
  "sections": {
    "mainColor": [ ... ],
    "mainColorNumber": [ ... ],
    "entropy": [ ... ],
    "edgeColor": [ ... ]
  }
}
```

### 3) 导出全局汇总报告

`GET /api/reports/projects/{projectId}/export?format=csv|xlsx|pdf`

**说明**
- 默认 `csv`
- 从最近成功任务结果中构建统一数据集并导出
- 文件保存目录：`storage/reports/{projectId}/`

**响应**
- `200 OK` 文件流下载
- `Content-Disposition: attachment; filename=summary.xxx`

## 鉴权

本模块接口均受 JWT 保护。

请求头需要携带：

`Authorization: Bearer <token>`

## 设计说明（与需求文档对应）

- 对应需求 3.4.1：单图明细报告 → `GET /images/{imageName}`
- 对应需求 3.4.2/3.4.3：全局汇总与钻取 → `GET /summary` + 单图接口
- 对应需求 3.4.4：导出能力 → `GET /export?format=...`

当前版本已覆盖 CSV/XLSX/PDF 导出；图像叠加可视化和图表可在下一迭代配合前端图表组件完成。
