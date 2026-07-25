# P1 分析项目 API

> 本文件定义项目分析模块的目标 API 验收基线。2026-07-21 之后改为异步、多数据集、模板必选契约；旧同步基线的历史 PASS 不自动继承。

## 前置条件

- AUTH-01：取得用户 A 的 `TOKEN`；另准备用户 B 的 Token，用于所有权隔离测试。
- DS-01 + DS-05：用户 A 至少有两个包含图片的数据集，并准备一个空数据集。
- TPL-01：准备一个图片文件可读取的模板；v1.0 区域仅由项目步骤 3 定义，模板 `regionsJson` 不作为前置条件。
- 准备一个可稳定触发 Python 处理失败的测试 fixture，以及足以观察 queued/running 状态的慢任务 fixture。
- Docker 环境中 MySQL、API、Python、Frontend 均可用。

## 目标契约

- 项目创建后状态为 `draft`，步骤 1 取得真实项目 ID，后续通过 `PUT /api/projects/{id}` 持续保存配置。
- 一个项目支持多个 `datasetIds`；后端不得只处理第一个数据集。
- `templateId` 必填，项目保存模板配置快照，历史项目不跟随模板后续修改。
- 前端只提交项目配置；`/run` 请求体为空，公开 API 不接受算法步骤或服务器文件系统路径。
- `POST /api/projects/{id}/run` 异步返回 HTTP 202 和 `taskId`，最终必须同时满足 `task.status=success`、`project.status=completed`。
- 没有有效图片/区域配置、缺少矫正文件或方法非法时，在创建 Task 前返回 HTTP 422，任务数量不得增加。
- 列表只返回当前 JWT 用户的项目；详情、更新、运行、取消、删除均校验 owner。
- 每次成功任务必须生成非空的 `mainColorCsv`、`mainColorNumberCsv`、`entropyCsv`。
- 出界分析、边缘 CSV 和面积分析均不进入 V1.0 执行链。
- 涂色面积分析及其独立输出本期不实现，不作为本文件通过门槛。
- 取消本期实现：queued 任务可立即取消，running 任务应在图片或算法步骤边界协作式停止。

## 用例

| ID | 场景 | 步骤 | 期望 | 状态 |
|----|------|------|------|------|
| PRJ-01 | 创建草稿项目 | `POST /api/projects`，传 name、两个 `datasetIds`、有效 `templateId` 和初始 config | 200；返回真实 ID；`status=draft`；owner 来自 JWT；数据集、模板和 config 完整 | PASS |
| PRJ-02 | 当前用户项目列表 | 用户 A 调 `GET /api/projects` | 200；包含 PRJ-01；含 createdAt/updatedAt；不包含用户 B 的私有项目 | PASS |
| PRJ-03 | 项目详情与模板快照 | `GET /api/projects/{id}`，随后修改原模板再查询 | 200；项目字段与 PRJ-01 一致；模板快照不随原模板变化 | PASS |
| PRJ-04 | 异步执行完整分析 | 第二步生成服务端矫正文件，保存第四步配置后以空请求体调用 `/run`，随后轮询项目和任务 | 首次返回 202 + taskId；任务最终 `success`；项目最终 `completed`；不得只凭 HTTP 202 判 PASS | PASS |
| PRJ-05 | 任务状态与进度 | 用 PRJ-04 的真实 taskId 调任务接口 | 可观察合法状态流转；progress 单调不下降且最终 100；params/result/startedAt/finishedAt 完整 | PASS |
| PRJ-06 | 空执行计划运行前校验 | 对无有效图片/区域配置的 draft 调 `/run`，运行前后查询任务数 | 返回 422；不创建 Task；不得返回 500；项目保持 draft | PASS |
| PRJ-07 | 创建项目无 Token | 无 Authorization 调 `POST /api/projects` | 401 | PASS |
| PRJ-08 | 查询真实任务无 Token | 无 Authorization 查询 PRJ-04 的真实 taskId | 401 | PASS |
| PRJ-09 | 模板必选与模板有效性 | 分别缺少 templateId、传不存在模板、传无图片或图片文件丢失的模板 | 均返回 422；不创建项目或任务；错误信息能区分原因；模板 regionsJson 不参与校验 | PASS |
| PRJ-10 | 多数据集有效性 | datasetIds 为空、含不存在 ID、含无权限数据集 | 返回 422 或 403；不创建项目或任务 | PASS |
| PRJ-11 | 向导持续保存与矫正恢复 | 多次 `PUT` 保存步骤、区域、图片方法配置；调用矫正接口后刷新并查询 corrections | 配置与最后提交一致；矫正状态和图片可从服务端恢复，不依赖 Blob URL | PASS |
| PRJ-12 | 重复运行幂等保护 | PRJ-04 处于 queued/running 时再次 `/run` | 409；不创建第二个活动任务 | PASS |
| PRJ-13 | Python 失败状态传播 | 使用专用失败 fixture 启动任务并轮询 | Task 最终 failed；Project 最终 failed；logs 有可读错误；不得生成正式报告 | PASS |
| PRJ-14 | 项目所有权隔离 | 用户 B 列表查询，并对用户 A 项目执行 GET/PUT/run/cancel/delete | 列表不泄露项目；其余操作返回 403 或不暴露资源的 404 | PASS |
| PRJ-15 | 多数据集选择性覆盖 | 两个数据集均有图片，但第四步只配置其中部分图片/区域 | Task 只处理已配置图片和区域；未配置图片不出现；同名图片以 datasetId + imageId 区分 | PASS |
| PRJ-16 | V1.0 固定输出契约 | 执行只含 `color_distribution` 的项目，并尝试提交 `boundary_check` | 三类基础 CSV 始终存在且非空；不生成 edgeColorCsv；边界方法返回 422 且不创建 Task | PASS |
| PRJ-17 | 取消 queued 任务 | 创建可保持 queued 的任务后调用 `POST /api/projects/{id}/cancel` | 200/202；Task 与 Project 最终 cancelled；不进入 running | PASS |
| PRJ-18 | 取消 running 任务 | 对慢任务进入 running 后调用 cancel 并轮询 | 接受取消请求；在步骤边界停止；最终 cancelled；不开放报告 | PASS |
| PRJ-19 | 禁止客户端步骤和路径参数 | `/run` 请求中注入 steps/modelImagePath/butterflyJsonPath/edgeJsonPath | 返回 422；不得读取或使用客户端指定值 | PASS |
| PRJ-20 | 删除项目及资源归属 | 用户 A 删除自己的 draft/completed 项目，再查询项目、任务和报告 | 删除成功；项目不可查询；任务/报告按约定级联或不可访问；用户 B 删除返回 403/404 | PASS |
| PRJ-21 | API 重启恢复遗留任务 | 使任务进入 queued/running 后重启 API；分别覆盖已请求取消和未请求取消 | 启动后不再保留僵尸活动状态；已请求取消的 Task/Project 收敛为 cancelled，其他遗留活动任务收敛为 failed；写入 finishedAt 和诊断 logs；项目不再受“运行中不可删除”限制 | PASS |
| PRJ-22 | 区域与图片执行计划唯一来源 | 使用无 regionsJson 模板创建 draft；保存步骤 3 区域、服务端矫正和部分图片配置后运行 | draft 创建成功；空区域返回 422；`analysis-plan.json` 只含项目配置的图片/区域及归一化多边形 | PASS |

## PRJ-04 发布门槛

PRJ-04 只有同时满足以下条件才算 PASS：

1. `/run` 返回 HTTP 202 和非空 taskId；
2. 使用该 taskId 轮询，而不是假设 `tasks[0]` 是本次任务；
3. Task 最终为 `success`，Project 最终为 `completed`；
4. progress 最终为 100；
5. `mainColorCsv`、`mainColorNumberCsv`、`entropyCsv` 存在、非空、表头合法，并覆盖全部成功分析图片；
6. 结果只覆盖第四步实际配置的图片和区域，并含 datasetId + imageId 清单；
7. 任务失败、超时或缺少必需输出时均不得判 PASS。

## 不在本期范围

- 涂色面积分析、独立 `areaCsv`、面积像素数或面积占比验收；
- 预计剩余时间的精确性；
- RabbitMQ/Celery 的特定实现方式，只验收外部异步行为和状态契约。

## 执行记录

| 执行人 | 日期 | 通过/总数 | 备注 |
|--------|------|-----------|------|
| Agent | 2026-06-24 | 4/7（旧基线） | 同步 MVP；PRJ-04 依赖固定模型路径 |
| Codex | 2026-07-21 | 8/8（旧基线） | 同步 MVP；PRJ-04 HTTP 200 且 task.status=success |
| Codex | 2026-07-21 | 20/20 | Docker 自动化复验：异步、多数据集、模板快照、owner 隔离、条件输出及 queued/running 取消全部通过 |
| Codex | 2026-07-22 | 1/1（PRJ-21） | 重建并重启 API 后，项目 721 与任务从 running 自动恢复为 cancelled；结束时间和恢复日志完整，删除状态限制解除 |
| Codex | 2026-07-22 | 1/1（PRJ-22） | 指定蝴蝶模板可创建 draft；空区域 422 且 Task 0→0；保存步骤 3 区域后返回 202，工作区区域文件来源正确 |
| Codex | 2026-07-24 | 9/9（V1.0 闭环范围） | Docker：PRJ-01/04/06/11/15/16/19/20/22；两数据集只执行已配置图片/区域，三类固定 CSV 非空，边界方法不建 Task |

参考：`backend/docs/需求说明.md`、`backend/APIdoc/project-analysis-api.md`。API 文档需在实现异步契约时同步更新。
