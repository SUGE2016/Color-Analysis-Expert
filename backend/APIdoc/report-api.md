# 分析报告与结果展示 API

## 约定

- 所有接口要求 JWT，并且只允许访问当前用户拥有的项目。
- 报告读取项目最近一次 `success` Task 的不可变快照。
- V1.0 只展示 `color_distribution` 的固定结果：颜色分布、主色像素数量、HSV 熵值。
- 未配置图片不进入报告；不返回出界、面积或线条结果。
- 图片身份使用 `imageId`，多数据集同名图片不会混淆。

## 1. 项目汇总

`GET /api/reports/projects/{projectId}/summary`

响应保留 `projectId`、`taskId`、`stats`、`preview` 和 `availableFiles`，并增加完整图片清单：

```json
{
  "images": [{
    "imageId": "image-uuid",
    "datasetId": "dataset-uuid",
    "fileName": "02_01_00.jpg",
    "displayName": "02_01_00.jpg",
    "regionCount": 5
  }]
}
```

汇总页应使用 `images` 生成钻取列表，不得从每类最多 20 行的 `preview` 推导图片全集。

## 2. 单图报告

`GET /api/reports/projects/{projectId}/images/{imageId}`

```json
{
  "project": {"id": "...", "name": "..."},
  "task": {"id": "...", "finishedAt": "..."},
  "image": {
    "imageId": "...",
    "datasetId": "...",
    "fileName": "02_01_00.jpg",
    "subjectCode": null,
    "capturedAt": "...",
    "correctedUrl": "...?variant=corrected"
  },
  "regions": [{
    "regionId": "region1",
    "name": "区域1",
    "polygon": [{"x": 0.1, "y": 0.2}],
    "validPixels": 2564,
    "colorDistribution": [
      {"key": "blue", "label": "蓝色", "count": 2547, "ratio": 0.9934, "color": "#1677ff"}
    ],
    "mainColorNumber": [
      {"key": "dark_blue", "label": "深蓝色", "count": 946, "color": "#10239e"}
    ],
    "entropy": {"h": 1.7682, "s": 1.7533, "v": 1.6342}
  }],
  "legacy": false
}
```

`ratio` 范围为 `0–1`。`mainColorNumber` 表示落入预设主色色域的像素数量，不表示不同颜色种类数。

旧请求可临时传唯一图片名；同名图片超过一张时返回 409，并要求改用 `imageId`。

## 3. 报告图片快照

`GET /api/reports/projects/{projectId}/images/{imageId}/file?variant=corrected`

- `corrected`：成功 Task 实际分析的矫正图片。
- V1.0 不保存或提供报告原图；`original` 及其他 variant 返回 400。
- 返回带正确 `Content-Type` 的内联文件流。

## 4. 单图 PDF

`GET /api/reports/projects/{projectId}/images/{imageId}/export?format=pdf`

- 单图只支持 PDF；其他格式返回 400。
- PDF 包含矫正图区域标注、颜色分布、主色像素数量和 HSV 熵值，不包含原图或样本标签。
- 文件缓存于 `storage/reports/{projectId}/{taskId}/{imageId}.pdf`。

## 5. 项目导出

`GET /api/reports/projects/{projectId}/export?format=csv|xlsx|pdf`

项目汇总继续支持 CSV、XLSX 和 PDF。

## 状态码

| 状态码 | 含义 |
|---|---|
| 400 | 参数或导出格式错误 |
| 403 | 项目不属于当前用户 |
| 404 | 项目/图片不存在，或图片不在最近成功 Task 中 |
| 409 | 尚无成功 Task，或旧图片名存在歧义 |
| 422 | 新版成功 Task 的固定结果或图片快照不完整 |
