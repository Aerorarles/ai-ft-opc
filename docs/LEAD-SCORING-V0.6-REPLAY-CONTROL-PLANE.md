# Lead Scoring v0.6 Replay Control Plane

版本：v0.6-control-plane-draft
日期：2026-07-01
状态：本地 replay 控制层实现完成，等待人工审查
适用范围：Lead Scoring v0.6 的 replay source routing、consistency arbitration、snapshot / event_store / memory 三层决策
禁止事项：本文不写 SQL，不创建 migration，不连接 PostgreSQL，不接 n8n、Docker、服务器或外部 API，不读取 secrets，不执行 Git 操作。

## 1. 核心变化

v0.6 之后，replay 不再只是一个执行函数。

Replay 的定义升级为：

```text
Replay = Decision + Routing + Validation + Execution
```

这意味着 replay 必须先判断使用哪一种事实来源，再执行重放或快照恢复，最后由一致性裁决层判断结果是否可信。

## 2. 为什么需要 Replay Control Plane

v0.5 已经具备三类数据来源：

- snapshot：最快，但不是事实来源；
- event_store：标准 replay 来源；
- memory：本地开发和测试 fallback。

如果 `replayExecution` 自己直接读取某一种来源，会产生几个风险：

- snapshot 不一致时仍被误用；
- event_store 不完整时无法安全 fallback；
- 本地开发与未来持久化行为分叉；
- 一致性错误缺少统一分类；
- engine 可能被迫知道 replay 来源，破坏职责边界。

因此 v0.6 引入 `ReplayRouter` 和 `replay-consistency`，把 replay 变成控制层。

## 3. 三层决策机制

### 3.1 Snapshot 优先

使用条件：

- snapshot 存在；
- `is_consistent = true`；
- `config_checksum` 匹配；
- `engine_version` 匹配。

满足时选择：

```text
source_used = snapshot
```

这是最快路径，适合 UI/API 快速读取，但仍不能替代 event stream 的历史事实地位。

### 3.2 Event Store Fallback

使用条件：

- snapshot 不存在或不一致；
- event store 可用；
- event stream 完整，至少包含 FeatureExtractionEvent 和 FinalScoreEvent。

满足时选择：

```text
source_used = event_store
```

这是标准 replay 路径，适合审计、debug、差异分析和一致性重算。

### 3.3 Memory Fallback

使用条件：

- event store 不可用；
- 或 execution 仍处于 local mode；
- 或本地测试没有启用持久化层。

满足时选择：

```text
source_used = memory
```

memory fallback 仅用于本地开发和测试，不是生产持久化方案。

## 4. Replay Decision Contract

`ReplayDecisionContext` 记录控制层决策所需的最小上下文：

- `execution_id`
- `config_checksum`
- `engine_version`
- `snapshot_status`
- `event_count`
- `has_missing_events`
- `checksum_valid`

该结构用于连接 router、replay execution 和 consistency arbitration。

## 5. Consistency Arbitration

`validateReplayConsistency()` 是一致性裁决层，负责把 replay 结果转化为明确的可信 / 不可信判断。

必须检查：

- snapshot 与 recompute 结果不一致；
- event_count mismatch；
- missing rule execution；
- checksum mismatch；
- ordering mismatch；
- engine version mismatch；
- final score 与重算结果不一致。

输出字段：

- `is_consistent`
- `consistency_errors`
- `inconsistency_type`

## 6. Inconsistency 分类

当前固定分类：

- `NONE`
- `MISSING_EVENTS`
- `CHECKSUM_MISMATCH`
- `ENGINE_VERSION_MISMATCH`
- `CONFIG_MISMATCH`
- `RERUN_DIFFERENCE`
- `ORDER_CORRUPTION`

分类的目的不是自动修复，而是为人工审核、审计 UI 和未来告警提供稳定语义。

## 7. 为什么 Engine 不能决定 Replay Source

Engine 的职责是：

- 提取 feature；
- 校验 config；
- 执行规则；
- 产生 event；
- 输出 score result；
- 可选写入 persistence hook。

Engine 不应决定 replay source，原因是：

- replay 是事后审计和恢复语义；
- source 选择依赖 snapshot/event store 状态；
- 未来可能有 multi-region、冷归档、只读副本；
- engine 直接选择来源会让评分计算和审计路由耦合。

因此 engine 只记录 `replay_source_preference = auto`，真正决策交给 `ReplayRouter`。

## 8. Replay Execution Lifecycle

```text
replayExecution(execution_id)
-> ReplayRouter.selectSource()
-> source = snapshot / event_store / memory
-> execute selected replay path
-> validateReplayConsistency()
-> return source_used + selection_reason + consistency_result
```

输出必须包含：

- `source_used`
- `selection_reason`
- `consistency_result`
- `recomputed_total_score`
- `final_score_event_total`
- `is_consistent`
- `inconsistency_type`

## 9. Future：Multi-region Replay 与 Distributed Audit

未来 SaaS 化后，replay control plane 可以扩展为：

- 按 tenant 和 region 选择最近 event store；
- snapshot 读本地缓存，event replay 读权威 region；
- 冷归档 event stream 按需恢复；
- audit UI 展示 replay source 和 consistency result；
- 跨 region 校验 config checksum 与 engine version；
- 对不一致 execution 生成人工审核任务。

这些能力进入实现前必须单独设计权限、数据模型、API、回滚和审计策略。

## 10. 验收标准

- snapshot valid 时选择 snapshot；
- snapshot invalid 时 fallback event_store；
- event_store failure 时 fallback memory；
- checksum mismatch 被分类；
- engine version mismatch 被分类；
- replay source selection deterministic；
- replay output 包含 selection_reason；
- engine 与 replay 决策解耦；
- 不连接数据库，不接 n8n，不访问外部 API。

## 11. 风险

- snapshot 被误判 valid 会隐藏 event stream 异常；
- event stream 完整性判断过松会导致错误 replay；
- memory fallback 若被误用于生产会破坏审计完整性；
- 不一致分类过粗会增加人工排查成本。

## 12. 回滚原则

当前 v0.6 只影响本地 replay 控制层。若需要回滚，可继续使用 v0.5 的 event replay 行为；评分计算逻辑和生产 v0.1 事实来源不受影响。

## 13. 下一步入口

下一阶段可以进入 v0.7 SaaS 化前设计：multi-tenant isolation、API scoring service、n8n integration boundary、admin rule UI schema 和 production deployment architecture。进入任何数据库、n8n、服务器或 Git 操作前必须获得用户明确批准。
