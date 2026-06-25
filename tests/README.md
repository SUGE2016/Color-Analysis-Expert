# 测试目录说明

本目录存放**测试计划、用例设计与后续自动化脚本**，与业务源码分离。

## 目录结构

```
tests/
├── README.md
├── test-plan.md
├── contracts/TEST-REPORT-CONTRACT.md   # 报告契约 v1
├── templates/                          # 摘要 / 报告 / latest-run 模板
├── cases/
├── fixtures/
├── results/                            # latest-run.txt、YYYY-MM-DD-report.md
└── scripts/run-p0-p1.sh
```

**Agent Skill：** `.cursor/skills/color-analysis-testing/`（跑测试、写摘要/报告时自动遵循）

## 执行顺序

1. **设计** — `test-plan.md` + `cases/`（已完成 v1）
2. **准备环境** — `docker compose up --build`
3. **自动回归** — `bash tests/scripts/run-p0-p1.sh`
4. **查看报告** — 按 `templates/` 生成 `results/latest-run.txt` 与 `results/YYYY-MM-DD-report.md`
5. **P2 手工** — `cases/P2-frontend-manual.md`（待做）

## 用例状态约定

设计阶段用「待测」；执行后与报告契约一致，仅使用：**PASS** | **FAIL** | **SKIP** | **BLOCK**（见 `contracts/TEST-REPORT-CONTRACT.md`）。

## 相关资源

- API 说明：`backend/APIdoc/`
- Postman：`backend/APIdoc/ColorAnalysis-backend.postman_collection.json`
- 默认账号：`admin` / `admin123`
