# 儿童涂色分析工具前端

基于 React 19 + Ant Design 6 的儿童涂色作品分析系统前端应用。

## 项目概述

这是一个用于儿童涂色作品分析的全栈应用前端部分，主要功能包括：

- **数据集管理** - 创建、管理和组织儿童涂色图片数据集
- **分析模板管理** - 管理分析模板，用于图像校正和区域定义
- **分析项目管理** - 创建分析任务，执行图像校正、区域检测和分析
- **报告生成** - 查看汇总报告和单图详细分析报告
- **工具箱** - 提供图像校正、边缘检测等独立工具

## 技术栈

- **框架**: React 19.2.4
- **UI 组件库**: Ant Design 6.3.1
- **路由**: React Router DOM 6.30.3
- **HTTP 客户端**: Axios 1.13.6
- **图表**: Recharts 3.8.0
- **构建工具**: Create React App 5.0.1

## 项目结构

```
src/
├── api/                    # API 接口层
│   ├── index.js           # Axios 实例配置
│   ├── index.export.js    # API 统一导出
│   ├── auth.js            # 认证相关 API
│   ├── group.js           # 分组管理 API
│   ├── dataset.js         # 数据集 API
│   ├── analysis.js        # 分析项目 API
│   ├── template.js        # 模板管理 API
│   ├── report.js          # 报告管理 API
│   └── tool.js            # 图像处理工具 API
├── components/            # 公共组件
│   ├── common/           # 通用组件
│   └── layout/           # 布局组件
├── pages/                # 页面组件
│   ├── LoginPage.jsx     # 登录页
│   ├── RegisterPage.jsx  # 注册页
│   ├── ToolboxPage.jsx   # 工具箱首页
│   ├── analysis/         # 分析模块
│   │   ├── AnalysisPage.jsx      # 分析项目列表
│   │   └── AnalysisCreatePage.jsx # 创建/编辑分析项目
│   ├── dataset/          # 数据集模块
│   │   ├── DatasetListPage.jsx   # 数据集列表
│   │   └── GroupListPage.jsx     # 分组管理
│   ├── report/           # 报告模块
│   │   ├── GlobalSummaryReportPage.jsx # 汇总报告
│   │   └── SingleImageReportPage.jsx   # 单图报告
│   └── toolbox/          # 工具箱模块
│       ├── ImageCorrectionPage.jsx  # 图像校正
│       └── EdgeDetectionPage.jsx    # 边缘检测
├── router/               # 路由配置
│   └── index.jsx
├── hooks/                # 自定义 Hooks
├── utils/                # 工具函数
└── assets/               # 静态资源
```

## 仓库结构（Monorepo）

| 目录 | 说明 |
|------|------|
| `/`（根目录） | React 前端 |
| `backend/` | Spring Boot API（Java） |
| `algorithm-service/` | Python 图像算法服务（Flask :5000） |

本地后端需 **MySQL 8**、**Java 17**、**Python 3.8+**；Spring Boot 默认 `8080`，Python 算法服务 `5000`。详见 `backend/README.md`。

## Docker Compose 启动（推荐）

```bash
cp .env.docker.example .env
docker compose up --build
```

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost:3000 | 开发热更新 |
| API | http://localhost:8080 | Spring Boot |
| Swagger | http://localhost:8080/swagger-ui/index.html | API 文档 |
| MySQL | localhost:3306 | 库名 `color_analysis`，默认密码见 `.env` |

默认账号：`admin` / `admin123`（首次启动由后端自动创建）。

生产静态前端（nginx 反代 `/api`）：

```bash
docker compose --profile prod up --build
# 访问 http://localhost:8088
```

构建使用清华 pip / npmmirror npm / 阿里云 Maven 镜像，可在 `.env` 中覆盖。

## 测试

- 用例与计划：[`tests/`](tests/)
- 报告契约：[`tests/contracts/TEST-REPORT-CONTRACT.md`](tests/contracts/TEST-REPORT-CONTRACT.md)
- 模板：[`tests/templates/`](tests/templates/)
- Cursor Skill：`.cursor/skills/color-analysis-testing/`（执行测试与撰写摘要/报告）

```bash
bash tests/scripts/run-p0-p1.sh   # 产出 tests/results/latest-run.txt
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm start
```

应用将在 [http://localhost:3000](http://localhost:3000) 运行。

### 构建生产版本

```bash
npm run build
```

构建产物将输出到 `build/` 目录。

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `REACT_APP_API_BASE_URL` | API 基础地址 | `http://localhost:8080/api` |
| `REACT_APP_UPLOAD_BASE_URL` | 文件上传地址 | 与 API 地址相同 |

---

## API 接口文档

### API 模块统一导出

```javascript
import { 
  authApi, 
  groupApi,
  datasetApi, 
  analysisApi, 
  templateApi,
  reportApi,
  toolApi,
  apiClient,
  uploadClient 
} from './api/index.export';
```

---

### 1. 认证模块 (authApi)

**文件**: `src/api/auth.js`

| 方法 | 接口 | 说明 | 参数 |
|------|------|------|------|
| `login(credentials)` | POST `/auth/login` | 用户登录 | `{ username, password }` |
| `register(data)` | POST `/auth/register` | 用户注册 | `{ username, password }` |

**使用示例**:
```javascript
import { authApi } from './api';

// 登录
authApi.login({ username: 'admin', password: '123456' });

// 注册
authApi.register({ username: 'user1', password: '123456' });
```

---

### 2. 分组模块 (groupApi)

**文件**: `src/api/group.js`

| 方法 | 接口 | 说明 | 参数 |
|------|------|------|------|
| `getGroups()` | GET `/dataset-groups` | 查询分组列表 | - |
| `createGroup(data)` | POST `/dataset-groups` | 创建分组 | `{ name, description }` |
| `getGroupDetail(id)` | GET `/dataset-groups/${id}` | 查询分组详情 | `id: number/string` |

**使用示例**:
```javascript
import { groupApi } from './api';

// 查询所有分组
groupApi.getGroups();

// 创建分组
groupApi.createGroup({ 
  name: '小班2024', 
  description: '2024年春季小班' 
});
```

---

### 3. 数据集模块 (datasetApi)

**文件**: `src/api/dataset.js`

| 方法 | 接口 | 说明 | 参数 |
|------|------|------|------|
| `getDatasets(params)` | GET `/datasets` | 查询数据集列表 | `{ groupId?, scene? }` |
| `createDataset(data)` | POST `/datasets` | 创建数据集 | `{ name, description?, ownerId, scene?, groupId? }` |
| `getDatasetDetail(datasetId)` | GET `/datasets/${id}` | 查询数据集详情 | `datasetId: string` |
| `getDatasetImages(datasetId)` | GET `/datasets/${id}/images` | 查询数据集图片 | `datasetId: string` |
| `uploadDatasetImages(datasetId, formData)` | POST `/datasets/${id}/images` | 上传图片 | `FormData` |
| `updateDataset(datasetId, data)` | PUT `/datasets/${id}` | 更新数据集 | `{ name?, description?, scene? }` |
| `deleteDataset(datasetId)` | DELETE `/datasets/${id}` | 删除数据集 | `datasetId: string` |
| `deleteDatasetImage(datasetId, imageId)` | DELETE `/datasets/${id}/images/${imageId}` | 删除单张图片 | - |
| `batchDeleteImages(datasetId, imageIds)` | POST `/datasets/${id}/images/batch-delete` | 批量删除 | `{ imageIds: string[] }` |

**使用示例**:
```javascript
import { datasetApi } from './api';

// 查询数据集列表
datasetApi.getDatasets({ groupId: '1', scene: 'classroom' });

// 创建数据集
datasetApi.createDataset({
  name: '春季作品集',
  description: '2024年春季儿童涂色作品',
  ownerId: '1',
  scene: 'classroom',
  groupId: '1'
});

// 上传图片
const formData = new FormData();
formData.append('file', file);
datasetApi.uploadDatasetImages('dataset-1', formData);

// 批量删除图片
datasetApi.batchDeleteImages('dataset-1', ['img-1', 'img-2']);
```

---

### 4. 分析项目模块 (analysisApi)

**文件**: `src/api/analysis.js`

| 方法 | 接口 | 说明 | 参数 |
|------|------|------|------|
| `getProjects()` | GET `/projects` | 查询项目列表 | - |
| `createProject(data)` | POST `/projects` | 创建分析项目 | `{ name, ownerId, datasetId, templateId, config? }` |
| `getProjectDetail(projectId)` | GET `/projects/${id}` | 查询项目详情 | `projectId: string` |
| `getProjectTasks(projectId)` | GET `/projects/${id}/tasks` | 查询任务列表 | `projectId: string` |
| `updateProject(projectId, data)` | PUT `/projects/${id}` | 更新项目 | `{ name?, description?, config? }` |
| `deleteProject(projectId)` | DELETE `/projects/${id}` | 删除项目 | `projectId: string` |
| `startAnalysis(projectId)` | POST `/projects/${id}/analyze` | 启动分析 | `projectId: string` |
| `stopAnalysis(projectId)` | POST `/projects/${id}/stop` | 停止分析 | `projectId: string` |
| `getAnalysisProgress(projectId)` | GET `/projects/${id}/progress` | 查询进度 | `projectId: string` |

**使用示例**:
```javascript
import { analysisApi } from './api';

// 创建分析项目
analysisApi.createProject({
  name: '涂色能力分析项目',
  ownerId: '1',
  datasetId: 'dataset-1',
  templateId: 'template-1',
  config: {
    // 分析配置
  }
});

// 启动分析
analysisApi.startAnalysis('project-1');

// 获取分析进度
analysisApi.getAnalysisProgress('project-1');

// 停止分析
analysisApi.stopAnalysis('project-1');
```

---

### 5. 模板管理模块 (templateApi)

**文件**: `src/api/template.js`

| 方法 | 接口 | 说明 | 参数 |
|------|------|------|------|
| `getTemplates(params)` | GET `/templates` | 获取模板列表 | `{ keyword?, page?, pageSize? }` |
| `getTemplateDetail(id)` | GET `/templates/${id}` | 获取模板详情 | `id: number/string` |
| `createTemplate(data)` | POST `/templates` | 创建模板 | `{ name }` |
| `updateTemplate(id, data)` | PUT `/templates/${id}` | 更新模板 | `{ name? }` |
| `deleteTemplate(id)` | DELETE `/templates/${id}` | 删除模板 | `id: number/string` |
| `uploadTemplateImage(id, formData)` | POST `/templates/${id}/image` | 上传模板图片 | `FormData` |

**使用示例**:
```javascript
import { templateApi } from './api';

// 查询模板列表
templateApi.getTemplates({ keyword: '精细动作', page: 1, pageSize: 10 });

// 创建模板
templateApi.createTemplate({ name: '精细动作能力分析模板' });

// 上传模板图片
const formData = new FormData();
formData.append('file', file);
templateApi.uploadTemplateImage('template-1', formData);

// 删除模板
templateApi.deleteTemplate('template-1');
```

---

### 6. 报告管理模块 (reportApi)

**文件**: `src/api/report.js`

| 方法 | 接口 | 说明 | 参数 |
|------|------|------|------|
| `getProjectSummaryReport(projectId)` | GET `/reports/projects/${id}/summary` | 项目汇总报告 | `projectId: string` |
| `getImageReport(projectId, imageId)` | GET `/reports/projects/${id}/images/${imageId}` | 单图报告 | - |
| `exportProjectReport(projectId, format)` | GET `/reports/projects/${id}/export` | 导出报告 | `format: 'pdf' \| 'excel' \| 'csv'` |

**使用示例**:
```javascript
import { reportApi } from './api';

// 获取项目汇总报告
reportApi.getProjectSummaryReport('project-1');

// 获取单图报告
reportApi.getImageReport('project-1', 'image-1');

// 导出PDF报告
reportApi.exportProjectReport('project-1', 'pdf');

// 导出Excel报告
reportApi.exportProjectReport('project-1', 'excel');
```

---

### 7. 图像处理工具模块 (toolApi)

**文件**: `src/api/tool.js`

| 方法 | 接口 | 说明 | 参数 |
|------|------|------|------|
| `cannyEdgeDetection(formData, config?)` | POST `/images/canny` | Canny 边缘检测 | `FormData, { threshold1?, threshold2? }` |
| `alignImage(formData)` | POST `/images/correction/align` | 图像校正对齐 | `FormData` |

**使用示例**:
```javascript
import { toolApi } from './api';

// Canny 边缘检测（阈值可选）
const formData = new FormData();
formData.append('file', imageFile);
toolApi.cannyEdgeDetection(formData, {
  threshold1: 50,   // 低阈值（可选）
  threshold2: 150   // 高阈值（可选）
});

// 图像校正对齐
const formData = new FormData();
formData.append('model', templateFile);  // 模板文件
formData.append('image', targetFile);    // 目标图片
toolApi.alignImage(formData);
```

---

## 页面路由说明

| 路由 | 页面 | 说明 |
|------|------|------|
| `/login` | 登录页 | 用户登录 |
| `/register` | 注册页 | 用户注册 |
| `/datasets` | 数据集列表 | 管理数据集 |
| `/groups` | 分组管理 | 管理数据分组 |
| `/analysis` | 分析项目 | 分析项目列表 |
| `/analysis/create` | 创建分析 | 新建分析项目向导 |
| `/analysis/edit/:id` | 编辑分析 | 编辑分析项目 |
| `/reports/summary/:projectId` | 汇总报告 | 项目汇总报告 |
| `/reports/image/:projectId/:imageId` | 单图报告 | 单张图片详细报告 |
| `/toolbox` | 工具箱 | 图像处理工具入口 |
| `/toolbox/correction` | 图像校正 | 图像校正工具 |
| `/toolbox/edge-detection` | 边缘检测 | 边缘检测工具 |

---

## HTTP 客户端使用

### 普通请求

```javascript
import { apiClient } from './api';

// GET 请求
apiClient.get('/users');

// POST 请求
apiClient.post('/users', { name: '张三' });

// PUT 请求
apiClient.put('/users/1', { name: '李四' });

// DELETE 请求
apiClient.delete('/users/1');
```

### 文件上传

```javascript
import { uploadClient } from './api';

const formData = new FormData();
formData.append('file', file);

// 上传文件（使用 uploadClient，超时 2 分钟）
uploadClient.post('/upload', formData);
```

---

## 注意事项

1. **认证令牌**: 系统自动从 `localStorage` 获取 `token` 并添加到请求头 `Authorization: Bearer ${token}`
2. **错误处理**: 响应拦截器统一处理 401/403/404/500 等错误并显示提示
3. **文件上传**: 上传接口使用 `uploadClient`，超时时间为 2 分钟
4. **响应格式**: 后端返回格式应为 `{ code, message, data }`，`code` 为 200 或 0 表示成功
5. **统一字段名**: 模板图片字段统一命名为 `templateImage`

---

## 部署

项目配置为部署到 GitHub Pages：

```bash
npm run build
```

配置在 `package.json` 中的 `homepage` 字段：
```json
{
  "homepage": "https://Yuxin0629.github.io/Coloring_Analysis_Tool"
}
```

---

## 浏览器兼容性

- Chrome (最新版)
- Firefox (最新版)
- Safari (最新版)
- Edge (最新版)

---

## License

MIT

