# 测试报告契约 v1

> 所有测试执行后的**摘要**与**报告**必须符合本契约。模板见 `tests/templates/`。

## 1. 产物清单

| 产物 | 路径 | 用途 |
|------|------|------|
| 机器记录 | `tests/results/latest-run.txt` | 脚本输出、CI 归档 |
| 完整报告 | `tests/results/YYYY-MM-DD-report.md` | 评审、留档 |
| 执行摘要 | 对话 / PR / 日报（由 `SUMMARY.template.md` 生成） | 人读、快速同步 |

可选：`tests/results/YYYY-MM-DD-run.json`（未来自动化扩展，字段同 §3）。

## 2. 用例状态（枚举）

| 状态 | 含义 | 计入通过？ |
|------|------|------------|
| `PASS` | 实测符合预期 | 是 |
| `FAIL` | 实测不符合预期 | 否 |
| `SKIP` | 本期故意不执行或前置不满足 | 单独统计，不计入 FAIL |
| `BLOCK` | 环境/依赖不可用，无法判定 | 单独统计 |

**禁止**使用「通过」「失败」等口语替代枚举值（表格与 `latest-run.txt` 中）。

## 3. `latest-run.txt` 格式（机器契约）

```
meta:
  run_at: <ISO8601>
  environment: docker|local
  api_base: http://localhost:8080
  frontend_base: http://localhost:3000
  script: tests/scripts/run-p0-p1.sh
  git_commit: <short-sha|unknown>

summary:
  pass: <int>
  fail: <int>
  skip: <int>
  block: <int>
  total: <int>

records:
<CASE_ID>|<STATUS>|<DETAIL>
...
```

- 一行一条用例，`DETAIL` 不含换行；`|` 出现在 detail 时需转义为 `\|`
- `CASE_ID` 必须与 `tests/cases/*.md` 中定义一致（如 `SMK-01`、`PRJ-04`）

## 4. 完整报告必填章节（`REPORT.template.md`）

1. 元信息（环境、脚本、commit、执行人）
2. 汇总表（pass/fail/skip/block + **一句话结论**）
3. 通过标准对照（对照 `test-plan.md` §4）
4. 分优先级结果（P0 / P1 按模块 / P2）
5. 失败与根因（每条 FAIL：`ID`、现象、根因、建议）
6. 测试过程发现（配置/脚本/契约修正，区别于产品缺陷）
7. 未执行范围
8. 建议后续

## 5. 摘要必填块（`SUMMARY.template.md`）

1. 一行结论（通过/不通过 + 阻塞项）
2. 数字汇总表
3. P0 结论
4. 失败项列表（仅 FAIL，最多 5 条）
5. 建议下一步（最多 3 条）

## 6. 发布门槛（默认，可经 `test-plan.md` 调整）

| 级别 | 门槛 |
|------|------|
| 合并/发布 | P0 全部 PASS；P1 核心链（AUTH → DS-05 → PRJ-04 task=success → RPT-01）无 FAIL |
| 日常回归 | P0 全部 PASS；P1 FAIL ≤ 已知缺陷清单 |

核心链用例 ID：`AUTH-01`、`DS-01`、`DS-05`、`PRJ-04`、`RPT-01`。

`PRJ-04` 采用异步契约：仅收到 HTTP 202 不算通过，必须使用返回的 taskId 轮询至 `task.status=success`，并确认 `project.status=completed` 与必需输出文件完整。

## 7. Agent 执行约定

执行或汇报测试时：

1. 先读 `tests/test-plan.md` 与相关 `tests/cases/*.md`
2. 跑 `tests/scripts/run-p0-p1.sh`（或等价步骤）
3. 用模板生成 `latest-run.txt` 与 `YYYY-MM-DD-report.md`
4. 向用户呈现的内容必须符合 `SUMMARY.template.md` 结构

详见项目 Skill：`.cursor/skills/color-analysis-testing/SKILL.md`
