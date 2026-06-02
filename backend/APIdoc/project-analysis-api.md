# 项目分析模块接口文档

## 1. 模块说明

项目分析模块用于串联：

1. 数据集管理模块（读取数据集图片目录）；
2. Python 算法模块（图像校正、HSV 提取、熵计算、主色统计等）；
3. 任务状态管理（Task 记录）；
4. 项目状态管理（Project 状态流转）。

当前实现为 **同步执行版本（MVP）**：调用 `POST /api/projects/{id}/run` 时会在本次请求内完成流水线执行。

---

## 2. 主要构成文件（项目内）

### Spring Boot 侧

- `src/main/java/com/coloranalysisbackend/model/Project.java`
- `src/main/java/com/coloranalysisbackend/model/Task.java`
- `src/main/java/com/coloranalysisbackend/repository/ProjectRepository.java`
- `src/main/java/com/coloranalysisbackend/repository/TaskRepository.java`
- `src/main/java/com/coloranalysisbackend/service/ProjectAnalysisService.java`
- `src/main/java/com/coloranalysisbackend/service/PythonClientService.java`
- `src/main/java/com/coloranalysisbackend/controller/ProjectController.java`
- `src/main/java/com/coloranalysisbackend/service/DatasetService.java`（提供 dataset 对应存储目录）

### Python 侧

- `color-analysis-python/app_http.py`（统一 HTTP 算法入口）
- `color-analysis-python/algo/image_correction.py`
- `color-analysis-python/algo/all_hsv.py`
- `color-analysis-python/algo/entropy_region.py`
- `color-analysis-python/algo/main_color.py`
- `color-analysis-python/algo/main_color_number.py`
- `color-analysis-python/algo/edge_color.py`

---

## 3. 项目分析状态机

### Project.status
- `created` -> `running` -> `completed` / `failed`

### Task.status
- `pending` -> `success` / `failed`

> 说明：当前版本未拆分 `running` 的 task 中间态（可在后续迭代补充 started_at/finished_at 与进度字段）。

---

## 4. 接口定义

所有接口都需要 JWT（Header: `Authorization: Bearer <token>`）。

### 4.1 创建分析项目

`POST /api/projects`

Request JSON:

```json
{
  "name": "项目A",
  "ownerId": "user-uuid",
  "datasetId": "dataset-uuid",
  "templateId": "template-uuid-or-null",
  "config": {
    "scene": "儿童发展评估"
  }
}
```

Response 200: `Project` 对象。

---

### 4.2 查询项目列表

`GET /api/projects`

Response 200: `Project[]`

---

### 4.3 查询单个项目

`GET /api/projects/{projectId}`

Response 200: `Project`

---

### 4.4 执行项目分析（核心）

`POST /api/projects/{projectId}/run`

Request JSON:

```json
{
  "steps": [
    "correction",
    "hsv",
    "edge_hsv",
    "entropy",
    "main_color",
    "main_color_number",
    "edge_color"
  ],
  "modelImagePath": "D:/OperationBasepoint/ColorAnalysis-backend/color-analysis-python/model_image.jpg",
  "butterflyJsonPath": "D:/OperationBasepoint/ColorAnalysis-backend/color-analysis-python/butterfly.json",
  "edgeJsonPath": "D:/OperationBasepoint/ColorAnalysis-backend/color-analysis-python/edge.json",
  "notes": "首次跑全流程"
}
```

Response 200: `Task` 对象（包含 `result` 字段，内含 `workspaceDir` 与输出文件路径）。

#### 可选步骤说明
- `correction`：图像校正
- `hsv`：掩膜 HSV 提取
- `edge_hsv`：边缘区域 HSV 提取
- `entropy`：HSV 熵计算
- `main_color`：主色统计
- `main_color_number`：颜色种类统计
- `edge_color`：边缘主色统计

---

### 4.5 查询项目任务列表

`GET /api/projects/{projectId}/tasks`

Response 200: `Task[]`

---

## 5. 当前已接入算法能力

1. 图像校正（`image_correction.process_folder`）
2. 掩膜 HSV 提取（`all_hsv.process_images_HSV`）
3. HSV 熵计算（`entropy_region.process_entropy_csv`）
4. 主色统计（`main_color.process_csv`）
5. 色彩种类统计（`main_color_number.process_csv`）
6. 边缘主色统计（`edge_color.process_csv`）

---

## 6. 已识别疏漏与后续建议

### 已补的疏漏
- 多个 Python 脚本原先是导入即执行，已改为 `if __name__ == '__main__'` 保护；
- `app_http.py` 原来有重复 `main` 与 `eval` 风险，已改为安全 JSON 解析；
- Java -> Python multipart 之前直接传 `byte[]`，现已改为带文件名的 multipart 资源。

### 仍需后续迭代（建议）
1. **异步任务执行**：目前 `/run` 为同步。建议迁移到 RabbitMQ/Celery 或 Spring 异步任务池 + 回调。
2. **项目进度反馈**：当前没有百分比进度，仅最终 success/failed。
3. **模板管理联动**：`templateId` 只是保留字段，尚未驱动模板配置逻辑。
4. **结果入库细粒度化**：目前主要输出到文件并写入 Task.result JSON，尚未写入 `results_summary` 表。
5. **路径参数规范化**：`modelImagePath`/json 路径当前由调用方传入，后续可改为模板管理后的逻辑引用。

---

## 7. 典型调用顺序

1. `POST /api/datasets` 创建数据集
2. `POST /api/datasets/{id}/images/upload` 上传图片
3. `POST /api/projects` 创建分析项目
4. `POST /api/projects/{id}/run` 执行分析
5. `GET /api/projects/{id}/tasks` 查询任务结果

---

## 8. 说明

文档位置：`APIdoc/project-analysis-api.md`

后续进入“项目报告生成模块”时，可直接基于 `Task.result` 里的输出路径与 `results_summary` 表进行报告聚合。