# 测试 Skill 参考

## 目录约定

```
tests/
├── contracts/TEST-REPORT-CONTRACT.md
├── templates/          # 勿改章节标题（契约一部分）
├── cases/              # 用例 ID 源
├── results/
│   ├── latest-run.txt  # 始终覆盖为最近一次
│   └── YYYY-MM-DD-report.md
└── scripts/run-p0-p1.sh
```

## Docker 环境默认值

| 服务 | 地址 |
|------|------|
| API | http://localhost:8080 |
| 前端 | http://localhost:3000（或 `.env` 的 `FRONTEND_PORT`） |
| 默认账号 | admin / admin123 |

## 已知缺陷（更新测试报告时核对）

| 影响用例 | 说明 |
|----------|------|
| ALG-02, ALG-03, PRJ-04 | `cv2.imshow` 在无头 Docker 失败 |
| RPT-* | 依赖 PRJ-04 `task.status=success` |

修复后应重跑脚本并更新报告「测试过程发现」与 FAIL 表。

## CI 建议（未实现）

```yaml
# 示例步骤
- run: docker compose up -d --build
- run: bash tests/scripts/run-p0-p1.sh
- run: test $(grep '^summary:' -A5 tests/results/latest-run.txt | grep fail | awk '{print $2}') -eq 0
```

## 与日报 / PR 的关系

- **日报**：只贴 SUMMARY 模板内容
- **PR Test plan**：链到 `tests/results/YYYY-MM-DD-report.md`
- **Issue**：每条 FAIL 对应一个 issue 或合并为一条阻塞项
