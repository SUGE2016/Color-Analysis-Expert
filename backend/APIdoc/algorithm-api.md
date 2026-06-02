# 图像处理算法接口文档

这些接口由 Python 服务提供，Spring Boot 统一转发，位于 `/api/images` 路径。

**相关后端文件**

* `PythonClientService.java` - 调用外部 Python 服务的客户端封装
* `ImageController.java` - 暴露 REST API
* `color-analysis-python/app_http.py` - Python HTTP 服务定义


## 1. Canny 多边形检测

```
POST /api/images/canny
Content-Type: multipart/form-data
```
* form-data `image`: 原始图像文件
* 可选字段 `config`：JSON 字符串(例如 `{"threshold1":50}`)

**成功返回** 200 JSON：
```json
{
  "regions": [ ... ],
  "metadata": {"original_width":..., "original_height":...}
}
```

## 2. 图像校正 - 角点检测

```
POST /api/images/correction/points
Content-Type: multipart/form-data
```
* `image`: 待检测图像

**返回** 200 JSON：
```json
{"points": [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]}
```

## 3. 图像校正 - 透视对齐

```
POST /api/images/correction/align
Content-Type: multipart/form-data
```
* `model`: 模板图像
* `image`: 待校正图像

**返回** 200 PNG 对齐后的图像


## 4. HSV 掩膜处理

```
POST /api/images/hsv/process
Content-Type: multipart/form-data
```
* `image`: 原图像
* `mask`: 掩膜图像

**返回** 200 PNG 处理后的图像


> 所有接口都需要在调用前通过 `/api/auth/login` 获取 JWT 并在 `Authorization` 头部带上 `Bearer <token>`。

接口文档已经添加至 `APIdoc/algorithm-api.md`，Swagger 同步可访问 `/swagger-ui/index.html` 查看这些新路径。