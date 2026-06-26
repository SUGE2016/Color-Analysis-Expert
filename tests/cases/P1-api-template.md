# P1 模板 API

**前置：** AUTH-01 取得 `TOKEN`。

| ID | 场景 | 步骤 | 期望 | 状态 |
|----|------|------|------|------|
| TPL-01 | 创建模板 | `POST /api/templates`（name + 可选 regions_json） | 200，含 `id` | SKIP |
| TPL-02 | 列表模板 | `GET /api/templates` | 200 数组 | PASS |
| TPL-03 | 单个模板 | `GET /api/templates/{id}` | 200 | SKIP |
| TPL-04 | 更新/删除 | 按 Swagger 现有方法（若有 PUT/DELETE） | 与文档一致 | SKIP |

> TPL-04：执行时对照 `http://localhost:8080/swagger-ui/index.html` 中 Template 控制器实际暴露的方法，若无删除则标「跳过」。

## 执行记录

| 执行人 | 日期 | 通过/总数 | 备注 |
|--------|------|-----------|------|
| Agent | 2026-06-24 | 1/4 (3 SKIP) | 仅测试列表查询，其他需要 fixtures 文件 |
