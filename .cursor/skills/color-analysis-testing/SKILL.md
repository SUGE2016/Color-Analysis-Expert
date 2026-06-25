---
name: color-analysis-testing
description: >-
  涂色分析 Monorepo 的测试计划、用例执行与报告契约。在用户要求跑测试、写测试日报/摘要/报告、
  更新用例状态或做发布前回归时使用。强制遵循 tests/contracts 与 tests/templates。
---

# Color Analysis 测试与报告

## 必读路径

| 资源 | 路径 |
|------|------|
| 契约 | [tests/contracts/TEST-REPORT-CONTRACT.md](../../tests/contracts/TEST-REPORT-CONTRACT.md) |
| 计划 | [tests/test-plan.md](../../tests/test-plan.md) |
| 用例 | [tests/cases/](../../tests/cases/) |
| 摘要模板 | [tests/templates/SUMMARY.template.md](../../tests/templates/SUMMARY.template.md) |
| 报告模板 | [tests/templates/REPORT.template.md](../../tests/templates/REPORT.template.md) |
| 机器记录模板 | [tests/templates/LATEST-RUN.template.txt](../../tests/templates/LATEST-RUN.template.txt) |
| 回归脚本 | [tests/scripts/run-p0-p1.sh](../../tests/scripts/run-p0-p1.sh) |

## 执行流程

1. 确认环境：`cp .env.docker.example .env` → `docker compose up -d`（或按 test-plan 本地环境）
2. 准备 fixtures：`tests/fixtures/images/sample.png`（见 fixtures README）
3. 执行：`bash tests/scripts/run-p0-p1.sh`
4. 将输出整理为契约格式，写入：
   - `tests/results/latest-run.txt`（必须符合 LATEST-RUN 模板）
   - `tests/results/YYYY-MM-DD-report.md`（由 REPORT 模板填写）
5. 向用户回复时，**必须**使用 SUMMARY 模板结构（不可省略「结论」「数字汇总」「失败项」）

## 报告契约（强制）

- 用例状态仅允许：`PASS` | `FAIL` | `SKIP` | `BLOCK`
- `CASE_ID` 与 `tests/cases/*.md` 一致
- **PRJ-04**：HTTP 200 不足，须核对 `task.status=success` 才算 PASS
- **ownerId**：API 请求须用 admin 的 UUID，不能传用户名 `admin`
- **模板创建**：`POST /api/templates` 为 `multipart/form-data`（`name`、`regionsJson`）
- **Canny/角点**：multipart 字段名为 `file`，不是 `image`

发布门槛见契约 §6；默认核心链：`AUTH-01`、`DS-01`、`DS-05`、`PRJ-04`、`RPT-01`。

## 摘要输出格式

用户可见回复采用 [SUMMARY.template.md](../../tests/templates/SUMMARY.template.md)，至少包含：

1. 一句话结论（达标/不达标）
2. 数字汇总表
3. P0 结论
4. FAIL 表（ID | 现象 | 根因）
5. 建议下一步（≤3 条）

## 完整报告

存档报告采用 [REPORT.template.md](../../tests/templates/REPORT.template.md) 全部章节，不得删减 §1～§8。

## 更新用例表

若手工执行：在对应 `tests/cases/*.md` 表格中将「状态」列改为 PASS/FAIL/SKIP/BLOCK，并填写文末「执行记录」表。

## 禁止

- 仅口头说「测过了」而不产出 `latest-run.txt` 或报告文件
- 混用「通过/失败」与 PASS/FAIL 枚举
- 跳过 SUMMARY 的「结论」与 FAIL 根因表

## 更多说明

契约字段与文件命名：[reference.md](reference.md)
