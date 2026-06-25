# 登录模块接口文档

该模块负责用户注册与认证，采用 JWT 实现无状态登录。所有接口位于 `/api/auth` 下。

## 公共地址
- Swagger UI：`http://localhost:8080/swagger-ui/index.html` （启动后可访问）
- OpenAPI JSON：`http://localhost:8080/v3/api-docs`

## 接口列表

### 1. 注册用户

```
POST /api/auth/register
Content-Type: application/json
```

**请求体**
```json
{
  "username": "string",
  "password": "string"
}
```

**成功响应**
- 状态码：200 OK
- 内容：
```json
{
  "id": "<新用户 UUID>"
}
```

**错误响应**
- 状态码：400 Bad Request
- 内容：字符串错误信息，例如 `用户名已存在`。

### 2. 登录获取 JWT

```
POST /api/auth/login
Content-Type: application/json
```

**请求体**
```json
{
  "username": "string",
  "password": "string"
}
```

**成功响应**
- 状态码：200 OK
- 内容：
```json
{
  "token": "<JWT 字符串>"
}
```

**失败响应**
- 状态码：401 Unauthorized
- 内容：`"认证失败"`

### 3. 使用 Token 访问受保护资源

在请求头中加入：
```
Authorization: Bearer <token>
```

之后访问其他需要登录的 API（如 `/api/images/canny`）即可。

---

> 默认启动时会创建账号 `admin` / `admin123` 便于测试。

接口已在 Swagger UI 中自动生成，可在启动后直接通过页面试用。