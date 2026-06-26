# P1 数据集与分组 API

**前置：** AUTH-01 取得 `TOKEN`；`export TOKEN=...`

| ID | 场景 | 步骤 | 期望 | 状态 |
|----|------|------|------|------|
| GRP-01 | 创建分组 | `POST /api/dataset-groups` `{"name":"测试分组"}` | 200，含 `id` | PASS |
| GRP-02 | 列表分组 | `GET /api/dataset-groups` | 200，含 GRP-01 | PASS |
| GRP-03 | 单个分组 | `GET /api/dataset-groups/{id}` | 200 | PASS |
| DS-01 | 创建数据集 | `POST /api/datasets` name+ownerId+可选 groupId/scene | 200，含 `id`、`fileCount:0` | PASS |
| DS-02 | 列表数据集 | `GET /api/datasets` | 200 数组 | PASS |
| DS-03 | 筛选数据集 | `GET /api/datasets?groupId={grp}&scene=教育研究` | 200，结果符合筛选 | PASS |
| DS-04 | 单个数据集 | `GET /api/datasets/{id}` | 200 | PASS |
| DS-05 | 上传图片 | `POST /api/datasets/{id}/images/upload` multipart `file`=fixtures 小图 | 200，含 `storageKey` | PASS |
| DS-06 | 列表图片 | `GET /api/datasets/{id}/images` | 200，含 DS-05 记录 | PASS |
| DS-07 | 不存在数据集 | `GET /api/datasets/00000000-0000-0000-0000-000000000000` | 404 | PASS |

## 依赖数据

- `ownerId`：可用登录用户 id，或文档中的 admin 对应 uuid（若接口允许字符串 `admin` 则按 APIdoc 实测记录）
- 上传文件：`tests/fixtures/images/sample.png`（待补充）

## 执行记录

| 执行人 | 日期 | 通过/总数 | 备注 |
|--------|------|-----------|------|
| Agent | 2024-06-24 | 10/10 | 全部通过，fixtures 已补充 |
