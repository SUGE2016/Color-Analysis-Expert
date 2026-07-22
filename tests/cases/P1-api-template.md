# P1 模板 API

**前置：** AUTH-01 取得 `TOKEN`。

| ID | 场景 | 步骤 | 期望 | 状态 |
|----|------|------|------|------|
| TPL-01 | 创建模板 | `POST /api/templates`，multipart 传 `name`、`imageFile`；`regionsJson` 仅为兼容可选字段 | 200；返回非空 `id`；`name` 与请求一致；`imageAvailable=true` | PASS |
| TPL-02 | 列表模板 | `GET /api/templates` | 200 数组；包含 TPL-01 创建的模板及其 `id`、`name`、`imageAvailable=true` | PASS |
| TPL-03 | 单个模板与图片 | `GET /api/templates/{id}`；分别请求 `GET /api/templates/{id}/image` 与 `/image/file` | 详情 200 且字段与创建结果一致；两个图片端点均为 200 且 `Content-Type` 为 `image/*` | PASS |
| TPL-04 | 更新/删除 | 新建独立临时模板；`PUT /api/templates/{id}` 更新 `name`、`imageFile`；`DELETE /api/templates/{id}`；再次查询 | 更新 200 且字段已持久化；删除 204；删除后查询 404 | PASS |
| TPL-05 | 禁止并过滤无图模板 | 不传 `imageFile` 创建模板；随后查询模板列表并核对实际图片端点 | 创建返回 400 和明确字段提示；列表中全部 `imageAvailable=true` 且图片端点可读；历史无图模板完成清理 | PASS |

## 执行记录

| 执行人 | 日期 | 通过/总数 | 备注 |
|--------|------|-----------|------|
| Agent | 2026-06-24 | 1/4 (3 SKIP) | 仅测试列表查询，其他需要 fixtures 文件 |
| Codex | 2026-07-21 | 3/4 (1 SKIP) | 创建/列表/单项 PASS，TPL-04 未脚本化 |
| Codex | 2026-07-21 | 4/4 | 四条均已自动化，覆盖创建、列表、详情、两个图片端点、更新和删除闭环 |
| Codex | 2026-07-22 | 1/1（TPL-05） | 缺少 imageFile 返回 400；清理 5 个无图无引用模板后，列表剩余 9 个且全部图片可用 |
