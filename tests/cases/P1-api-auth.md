# P1 认证 API

**前置：** SMK-03 通过；API 基址 `http://localhost:8080`。

| ID | 场景 | 步骤 | 期望 | 状态 |
|----|------|------|------|------|
| AUTH-01 | 正确登录 | `POST /api/auth/login` admin/admin123 | 200 + `token` 非空 | PASS |
| AUTH-02 | 错误密码 | 同上，密码错误 | 401，`认证失败` 或等价 | PASS |
| AUTH-03 | 缺少字段 | body 仅 `username` | 400 | PASS |
| AUTH-04 | 注册用户 | `POST /api/auth/register` 新用户名 | 200 + `id` | PASS |
| AUTH-05 | 重复注册 | AUTH-04 同一 username 再注册 | 400，用户名已存在类提示 | PASS |

## 执行记录

| 执行人 | 日期 | 通过/总数 | 备注 |
|--------|------|-----------|------|
| Agent | 2026-06-24 | 5/5 | 全部通过 |
