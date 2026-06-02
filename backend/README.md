# 涂色图像分析工具 - 后端

基于 Web 的涂色图像分析平台，提供从图像数据导入、数据集组织、分析流程配置到最终分析报告生成的全生命周期管理。平台旨在标准化数据处理、分析执行和结果输出，形成高效、可复用的分析闭环。

## 功能模块

### 1. 用户认证模块

- 用户注册与登录
- JWT Token 认证
- 会话管理

### 2. 数据集管理模块

- 创建和管理图像数据集
- 上传图像文件（支持 JPG/PNG）
- 数据集分组管理
- 图像预览与列表

### 3. 项目分析模块

- 创建分析项目
- 配置分析参数（数据集、模板、区域定义）
- 执行图像矫正、区域分析、颜色分析等步骤
- 异步任务执行与进度跟踪

### 4. 报告生成模块

- 生成单张图片分析报告
- 全局汇总报告
- 支持 CSV、XLSX、PDF 导出

### 5. 图像处理算法服务

- 图像矫正（几何变换）
- 边缘检测与区域分割
- HSV 颜色分析
- 熵值计算
- 主色调提取

## 技术栈

### 后端

- **框架**：Spring Boot 3.x
- **语言**：Java 17
- **安全**：Spring Security + JWT
- **数据库**：MySQL 8.0
- **ORM**：JPA/Hibernate
- **API**：RESTful API
- **文档**：OpenAPI/Swagger

### 算法服务

- **框架**：Flask
- **语言**：Python 3.8+
- **图像处理**：OpenCV, scikit-image, Pillow
- **数据处理**：Pandas, NumPy

### 基础设施

- **构建工具**：Maven
- **版本控制**：Git
- **API 测试**：APIfox

## 项目结构

```
ColorAnalysis-backend/
├── src/main/java/com/coloranalysisbackend/
│   ├── ColorAnalysisBackendApplication.java    # 主启动类
│   ├── config/                                  # 配置类
│   │   ├── CorsConfig.java                      # CORS 配置
│   │   ├── DataInitializer.java                 # 数据初始化
│   │   ├── PythonProperties.java                # Python 服务配置
│   │   ├── SecurityConfig.java                  # 安全配置
│   │   └── WebClientConfig.java                 # WebClient 配置
│   ├── controller/                              # REST 控制器
│   │   ├── AuthController.java                  # 认证接口
│   │   ├── DatasetController.java               # 数据集接口
│   │   ├── ImageController.java                 # 图像接口
│   │   ├── ProjectController.java               # 项目接口
│   │   └── ReportController.java                # 报告接口
│   ├── model/                                   # 数据模型
│   │   ├── Dataset.java
│   │   ├── Image.java
│   │   ├── Project.java
│   │   ├── Task.java
│   │   ├── User.java
│   │   └── Template.java
│   ├── repository/                               # 数据访问层
│   ├── security/                                 # 安全相关
│   │   ├── CustomUserDetailsService.java
│   │   ├── JwtAuthenticationFilter.java
│   │   └── JwtUtil.java
│   └── service/                                  # 业务逻辑层
│       ├── AuthService.java
│       ├── DatasetService.java
│       ├── ProjectAnalysisService.java
│       ├── PythonClientService.java
│       └── ReportService.java
├── src/main/resources/
│   ├── application.properties                    # 应用配置
│   └── static/                                   # 静态资源
├── color-analysis-python/                        # Python 算法服务
│   ├── app_http.py                               # Flask 应用
│   ├── algo/                                     # 算法模块
│   │   ├── canny.py
│   │   ├── image_correction.py
│   │   ├── all_hsv.py
│   │   └── ...
│   ├── requirements.txt                          # Python 依赖
│   └── sql/schema.sql                            # 数据库建表脚本
├── docs/                                         # 项目文档
├── pom.xml                                        # Maven 配置
└── README.md                                      # 项目说明
```

## 快速开始

### 环境要求

- Java 17+
- Python 3.8+
- MySQL 8.0+
- Maven 3.6+

### 数据库设置

~~目前还建在本地~~

1. 创建 MySQL 数据库：

   ```sql
   CREATE DATABASE color_analysis DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
   ```
2. 运行建表脚本：

   - 打开 Navicat 或其他 MySQL 客户端
   - 执行 `color-analysis-python/sql/schema.sql`
3. 修改 `src/main/resources/application.properties` 中的数据库配置：

   ```properties
   spring.datasource.url=jdbc:mysql://localhost:3306/color_analysis?useSSL=false&serverTimezone=UTC
   spring.datasource.username=your_username
   spring.datasource.password=your_password
   ```

### 启动 Python 算法服务

```bash
cd color-analysis-python
pip install -r requirements.txt
python app_http.py
```

服务将在 `http://localhost:5000` 启动。

### 启动 Spring Boot 后端

```bash
cd ..
./mvnw clean spring-boot:run
```

后端将在 `http://localhost:8080` 启动。

### 验证启动

- 访问 `http://localhost:8080/api/auth/login` 进行登录测试
- 默认管理员账号：`admin` / `admin123`

## API 文档

详细 API 文档可通过 Swagger 访问：`http://localhost:8080/swagger-ui.html`
