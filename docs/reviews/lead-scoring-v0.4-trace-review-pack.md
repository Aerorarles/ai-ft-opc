# Lead Scoring v0.4 Trace Review Pack

版本：v0.4-review-pack
日期：2026-07-01
状态：本地集成修复与验收完成，等待人工审查
适用范围：AI FT-OPC Lead Scoring 本地 scoring-engine v0.4 Execution Trace
禁止事项：本文不包含 SQL，不创建 migration，不修改数据库、Trigger、n8n、Docker、服务器或 Git，不访问外部 API，不读取 secrets。

## 1. 修改文件清单

- `scoring-engine/src/types.ts`
- `scoring-engine/src/execution-context.ts`
- `scoring-engine/src/execution-events.ts`
- `scoring-engine/src/engine.ts`
- `scoring-engine/src/replay.ts`
- `scoring-engine/src/test-cases.ts`
- `scoring-engine/src/trace-example.ts`
- `docs/LEAD-SCORING-V0.4-EXECUTION-TRACE.md`
- `docs/reviews/lead-scoring-v0.4-trace-review-pack.md`

## 2. 本地测试结果

- 运行方式：使用本地 bundled Node.js，不安装依赖。
- `scoring-engine/src/example.ts`：通过，输出 `total_score = 21`。
- `scoring-engine/src/test-cases.ts`：33 项测试，33 通过，0 失败。
- `scoring-engine/src/trace-example.ts`：通过，输出 trace 时间线与 replay 一致性结果。

## 3. Trace 示例摘要

示例 Lead 使用本地脱敏输入运行 v1 配置：

- `event_count = 11`
- 事件顺序：
  - FeatureExtractionEvent
  - 5 条 RuleEvaluationEvent
  - 4 条 DimensionScoreUpdateEvent
  - FinalScoreEvent
- 最终分数：`21`

示例输出不包含完整邮箱、完整电话、HTML、headers、cookies、response、stack 或 secrets。

## 4. Replay Consistency 结果

`trace-example.ts` replay 结果：

- `replay_consistency = true`
- `recomputed_total_score = 21`
- `consistency_errors = []`

新增测试已覆盖人为篡改 FinalScoreEvent 的情况，replay 会返回 `is_consistent = false` 并记录 `final_score_mismatch`。

## 5. 已完成的 v0.4 集成点

- 每次有效评分初始化或接收 execution context。
- 每次执行前清空当前 `execution_id` 的旧内存 trace。
- Feature extraction 产生 FeatureExtractionEvent。
- 每条规则产生 RuleEvaluationEvent 或 RuleSkippedEvent。
- blocking 命中产生 BlockingEvent。
- override group 决策产生 OverrideEvent。
- 每次维度变化产生 DimensionScoreUpdateEvent。
- 最终产生 FinalScoreEvent。
- ScoreResult 输出 `execution_id`、`event_count`、`execution_trace_summary`、`rule_execution_path`、`blocking_path`、`override_path`。
- 配置校验失败时返回 `total_score = null`，并保留最小 trace。
- Replay 基于 DimensionScoreUpdateEvent 与 scoring weights 独立重算总分，不只信任 FinalScoreEvent。
- Replay 会检查上下文锚点、顺序、重复事件和最终分数一致性。

## 6. 当前未涉及内容

- 数据库：未涉及。
- SQL / migration：未涉及。
- PostgreSQL Trigger：未涉及。
- n8n：未涉及。
- Docker：未涉及。
- 服务器命令：未涉及。
- Git 写操作：未涉及。
- secrets / configs / credentials / API Key / Cookie / 数据卷：未涉及。
- 外部 API：未涉及。

## 7. 已知限制

- 当前 event store 是内存实现，进程重启后 trace 丢失。
- 当前不提供持久化审计、跨服务 replay、长期查询或并发隔离。
- 当前 outcome policy 仍为占位映射，不写回 `grade` 或 `priority`。
- 当前 v0.4 仍是本地 scoring engine 能力，不是生产评分事实来源。

## 8. 下一阶段需用户明确批准

- 是否进入持久化 event store 的数据模型设计。
- 是否创建 SQL 草案。
- 是否设计数据库 migration。
- 是否设计 shadow-run 与数据库快照表。
- 是否接入 n8n 或管理后台。
- 是否申请修改现有 Trigger 或生产评分路径。

## 9. 验收标准

- 本地 example、test-cases、trace-example 均通过；
- replay 能独立重算并校验最终分数；
- trace 中不保存敏感原文；
- 失败配置不会继续规则评分；
- 不涉及生产系统写入。

## 10. 风险

- 内存 trace 无法长期保留；
- 若未来持久化字段不足，历史评分无法严格重放；
- 若未来 UI 展示未做脱敏，可能暴露敏感输入摘要；
- 若直接将 v0.4 结果写回生产评分字段，会破坏 shadow-ready 边界。

## 11. 回滚原则

当前改动只影响本地 scoring-engine。若需回滚，可停止使用 v0.4 trace 与 replay 输出，继续使用 v0.3 聚合评分语义。生产 v0.1 评分事实来源不受影响。

## 12. 下一步入口

下一步只能是人工审查本验收包与 v0.4 文档。未经用户明确批准，不进入 SQL、migration、数据库、n8n、Docker、服务器或 Git 操作。
