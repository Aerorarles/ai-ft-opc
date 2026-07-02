# Lead Scoring v0.4 Execution Trace

版本：v0.4-integration
日期：2026-07-01
状态：本地评分内核事件追踪与 replay 集成修复完成，等待人工验收
适用范围：Lead Scoring 本地 scoring-engine 的 execution trace、event sourcing、replay、debug 与 observability
禁止事项：本文不包含 SQL，不创建 migration，不修改数据库、Trigger、n8n、Docker、服务器或 Git，不访问外部 API，不读取 secrets。

## 1. 目标

v0.4 将 scoring 从“结果输出系统”升级为“完整执行过程可回放系统”。每一次有效评分都必须形成一条 event stream；每条规则的评估、跳过、阻断、覆盖、维度分数变化和最终结果都必须可追踪。

当前实现仍为本地内存模型，不连接数据库，不写入生产 `leads.score`、`grade` 或 `priority`。

## 2. Event Sourcing 架构

执行链路：

```text
Lead
-> Feature Extraction
-> Config Validation
-> Execution Context Init
-> Event Stream Start
-> Rule Precedence Evaluation
-> Dimension Scoring
-> Outcome Policy Mapping
-> FinalScoreEvent
-> Explanation / Replay
```

`ScoreResult` 是当前执行的聚合视图；event stream 是更底层的事实记录。未来如需持久化，应保存 event stream，而不是只保存最终分数。

## 3. Trace 与 Execution Context 的绑定

每个事件都必须携带足够的运行语义锚点，使 trace 脱离当前进程后仍能识别来源：

- `execution_id`
- `lead_id`，可选
- `config_version_id`
- `config_checksum`
- `outcome_policy_id`
- `outcome_policy_version`
- `outcome_policy_checksum`
- `engine_version`
- `trigger_source`
- `run_mode`
- `idempotency_key`
- `request_trace_id`
- `tenant_id`，可选
- `sequence_index`

有效评分事件还携带 `scoring_weights`，用于 replay 时独立重算总分。配置校验失败时不继续规则执行，但仍保留 FeatureExtractionEvent 与 FinalScoreEvent。

## 4. Event Types

### 4.1 FeatureExtractionEvent

记录 feature extraction 的摘要和 flags，只保存：
- `input_summary`
- `has_email`
- `has_phone`
- `has_website`
- `has_signals`

不得保存完整邮箱、完整电话、HTML、headers、cookies、response、stack 或 secrets。

### 4.2 RuleEvaluationEvent

记录规则被实际评估后的结果：
- `rule_id`
- `rule_type`
- `field`
- `operator`
- `matched`
- `raw_delta`
- `dimension`
- `priority`
- `weight`
- `expected_value`
- `actual_value_summary`

`actual_value_summary` 必须脱敏。邮箱只表达 `has_email=true/false`，电话只表达 `has_phone=true/false`。

### 4.3 RuleSkippedEvent

记录规则没有进入评估或计分的原因：
- `blocked`
- `overridden`
- `invalid_field`
- `invalid_operator`
- `lower_priority`

每条规则在一次 execution 中应只进入 `RuleEvaluationEvent` 或 `RuleSkippedEvent` 其中一种终态。

### 4.4 BlockingEvent

记录 blocking rule 命中后停止同维度后续规则：
- `dimension`
- `blocking_rule_id`

### 4.5 OverrideEvent

记录 override group 决策：
- `override_group`
- `selected_rule_id`
- `skipped_rule_ids`

### 4.6 DimensionScoreUpdateEvent

记录每次维度分数变化：
- `dimension`
- `delta`
- `running_total`
- `rule_id`

Replay 必须优先基于该事件重建 breakdown，不能只信任最终事件。

### 4.7 FinalScoreEvent

记录最终聚合结果：
- `total_score`
- `breakdown`

Replay 需要重新计算总分，并与 `FinalScoreEvent.total_score` 做一致性校验。

## 5. Replay 独立重算

`replayExecution(execution_id)` 必须：

- 按 `sequence_index` 顺序读取事件；
- 根据 `DimensionScoreUpdateEvent` 重建四个维度；
- 从事件上下文读取 `scoring_weights`；
- 重新计算 `recomputed_total_score`；
- 与 `FinalScoreEvent.total_score` 比较；
- 返回 `is_consistent` 与 `consistency_errors`；
- 返回 `blocked_dimensions`、`blocking_path`、`override_path` 和 `execution_context_summary`。

Replay 不得仅信任 `FinalScoreEvent`。如果缺少权重、版本锚点、顺序异常或同一规则重复更新，必须安全失败并写入 `consistency_errors`。

## 6. 安全失败策略

以下情况不得假装 replay 成功：

- 缺少 `config_checksum`、`engine_version`、`idempotency_key` 等上下文锚点；
- 缺少 `scoring_weights` 且需要重算非空总分；
- 事件 `sequence_index` 非递增；
- 同一 `rule_id` 在一次 execution 中出现多个终态事件；
- 同一 `rule_id` 出现重复 `DimensionScoreUpdateEvent`；
- 有维度更新但没有对应的命中规则事件；
- 重算总分与 FinalScoreEvent 不一致。

## 7. 当前内存 Store 局限

当前 `execution-trace-store.ts` 是进程内内存实现：

- 进程重启后 trace 丢失；
- 不适合跨服务 replay；
- 不提供持久化审计；
- 不提供并发隔离或长期查询能力；
- 仅用于本地内核验证和设计验收。

未来持久化前必须先单独设计数据模型、SQL 草案、影响范围和回滚方案，并获得用户明确批准。

## 8. 未来持久化最小字段

未来 event store 至少需要保存：

- event 基础字段；
- execution context 锚点；
- config checksum；
- outcome policy checksum；
- engine version；
- sequence index；
- 脱敏 feature summary；
- 规则评估摘要；
- 维度分数更新；
- final score；
- replay consistency 状态。

不得保存 HTML、headers、cookies、stack、原始响应体、完整邮箱、完整电话、API Key、credentials 或 secrets。

## 9. Debug 与 Observability

v0.4 explainability 输出：

- `execution_trace_summary`
- `event_count`
- `rule_execution_path`
- `blocking_path`
- `override_path`

这些字段用于定位规则为何命中、为何跳过、blocking 是否触发、override group 选择了哪条规则，以及 final score 是否能从事件流重放。

## 10. Future UI Debug Timeline

未来管理后台可基于事件流展示脱敏时间线：

```text
Feature extracted
-> Rule A evaluated and matched
-> Rule B skipped by lower priority
-> Override group selected Rule A
-> Dimension relevance +20
-> Final score 21
```

UI 只能展示脱敏摘要，不展示完整邮箱、电话、HTML、headers、cookies、stack 或外部响应体。

## 11. 验收标准

- 每次有效 scoring 产生 event stream；
- 配置校验失败仍产生最小 trace；
- 每条规则有 evaluation 或 skipped 终态；
- blocking 与 override 可观测；
- DimensionScoreUpdateEvent 可重建 breakdown；
- replay 独立重算总分并校验 FinalScoreEvent；
- trace 中有完整版本与运行上下文锚点；
- 不影响 v0.2 / v0.3 配置和执行语义。

## 12. 风险

- 内存 store 不具备长期审计能力；
- 如果未来持久化缺少 checksum 或 engine version，历史评分不可证明；
- 如果事件保存敏感原文，会引入安全风险；
- 如果规则重复事件未被识别，可能导致 replay 误判。

## 13. 回滚原则

当前 v0.4 是本地内存事件层，不影响生产系统。若需要回滚，可停止使用 execution trace 与 replay 模块，保留 v0.3 评分输出语义。生产 v0.1 评分事实来源不受影响。

## 14. 下一步入口

下一步只能是本地测试、文档审查和设计评估。未经用户明确批准，不进入 SQL、migration、数据库、n8n、Docker、服务器或 Git 操作。
