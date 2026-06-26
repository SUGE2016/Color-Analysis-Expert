# P0 冒烟用例

**前置：** `docker compose up -d` 且全部容器 Running；或本地等价环境。

| ID | 场景 | 步骤 | 期望 | 自动化候选 | 状态 |
|----|------|------|------|------------|------|
| SMK-01 | MySQL 健康 | `docker compose ps`，mysql 为 healthy | healthy | compose healthcheck | PASS |
| SMK-02 | Python 存活 | `docker logs color-python` 无 traceback；或 `curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/`（仅当端口暴露时） | 进程正常 / 非 5xx | 脚本 | PASS |
| SMK-03 | API 启动 | `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/swagger-ui/index.html` | `200` | `scripts/smoke.sh` | PASS |
| SMK-04 | OpenAPI | `GET http://localhost:8080/v3/api-docs` | `200`，JSON 含 `paths` | 脚本 | PASS |
| SMK-05 | 登录 | `POST /api/auth/login` body `{"username":"admin","password":"admin123"}` | `200`，body 含 `token` | 脚本 | PASS |
| SMK-06 | 受保护接口 | SMK-05 的 token + `GET /api/datasets` | `200`，数组（可为空） | 脚本 | PASS |
| SMK-07 | 无 token 拒绝 | `GET /api/datasets` 不带 Authorization | `401` 或 `403` | 脚本 | PASS |
| SMK-08 | 前端页面 | 浏览器打开 `http://localhost:3000`（或 `FRONTEND_PORT`） | 页面加载，无白屏 | 手工 | SKIP |

## SMK-05 请求示例

```bash
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## 执行记录

| 执行人 | 日期 | 环境 | 通过/总数 | 备注 |
|--------|------|------|-----------|------|
| Agent | 2026-06-24 | Docker | 7/8 (1 SKIP) | SMK-08 前端页面手工跳过 |
