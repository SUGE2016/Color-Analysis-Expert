# 用例索引

执行前请先阅读 [`../test-plan.md`](../test-plan.md)。

## 汇总

| 文件 | 级别 | 用例数 | 说明 |
|------|------|--------|------|
| [P0-smoke.md](./P0-smoke.md) | P0 | 8 | 环境与存活 |
| [P1-api-auth.md](./P1-api-auth.md) | P1 | 5 | 认证 |
| [P1-api-dataset.md](./P1-api-dataset.md) | P1 | 10 | 数据集与分组 |
| [P1-api-template.md](./P1-api-template.md) | P1 | 4 | 模板 |
| [P1-api-project.md](./P1-api-project.md) | P1 | 7 | 分析项目 |
| [P1-api-algorithm.md](./P1-api-algorithm.md) | P1 | 5 | 图像算法（经 API 转发） |
| [P1-api-report.md](./P1-api-report.md) | P1 | 4 | 报告 |
| [P2-frontend-manual.md](./P2-frontend-manual.md) | P2 | 8 | 前端页面手工 |
| **合计** | | **51** | |

## ID 编码规则

`{模块}-{序号}`，模块缩写：

- `SMK` 冒烟、`AUTH` 认证、`GRP` 分组、`DS` 数据集、`TPL` 模板
- `PRJ` 项目、`ALG` 算法、`RPT` 报告、`UI` 前端

## 执行记录模板

在每文件末尾「执行记录」表填写：执行人、日期、环境（Docker/本地）、通过数/总数。
