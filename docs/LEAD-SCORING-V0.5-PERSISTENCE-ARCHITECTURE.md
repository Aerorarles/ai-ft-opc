# Lead Scoring v0.5 Persistence Architecture

版本：v0.5-architecture-draft
日期：2026-07-01
状态：本地持久化接口与数据库架构设计完成，等待人工审查
适用范围：Lead Scoring v0.4 到 v0.5 的 event persistence 升级路径、接口边界、snapshot 与 replay 策略
禁止事项：本文不执行数据库连接，不执行 migration，不创建真实表，不写生产数据，不接 n8n、Docker、服务器或外部 API，不读取 secrets。

## 1. v0.4 到 v0.5 升级路径

v0.4 已具备内存版 event sourcing：

- 每次 scoring 生成 event stream；
- 每条规则执行可追踪；
- blocking / override 可观测；
- replay 可从事件独立重算。

v0.5 在此基础上新增：

- PostgreSQL 风格 event store schema 草案；
- `EventStore` 抽象接口；
- PostgreSQL adapter stub；
- engine 可选 persistence hook；
- replay 支持 snapshot、event store、memory fallback 三层来源。

当前仍不连接数据库，不执行 SQL，不接 n8n。

## 2. Memory Store 到 Event Store 的迁移策略

阶段建议：

1. local-only：继续使用内存 store 和本地测试；
2. adapter dry-run：实现 adapter 但连接 mock，不连真实数据库；
3. SQL 草案审查：单独提交 migration 草案、影响范围与回滚方案；
4. shadow persistence：只持久化 shadow scoring，不写 `leads.score`；
5. replay audit：比较 DB replay 与内存 replay；
6. API / n8n 接入前审查：明确权限、限流、幂等、审计和回滚。

迁移期间，v0.1 生产评分仍是事实来源。v0.5 不得直接覆盖生产评分字段。

## 3. 为什么 Event Store 必须 Append-only

评分系统需要回答“当时为什么得到这个分数”。如果历史事件可以被修改，审计、回放和差异分析都会失去可信度。

Append-only 带来的边界：

- 事件一旦写入不得修改；
- 修正通过追加补偿事件或新 execution；
- snapshot 可以重建；
- replay index 可以更新一致性状态；
- event stream 是历史事实来源。

## 4. 为什么需要 Snapshot Layer

Event stream 适合审计和 replay，但不适合所有读路径。

Snapshot 的用途：

- 快速显示 total score 和 breakdown；
- 支持 UI / API 查询；
- 减少每次列表页都 replay 全量事件；
- 保存脱敏摘要，避免暴露原始输入。

Snapshot 的限制：

- 不是事实来源；
- 不可替代 event stream；
- 若 snapshot 与 replay 不一致，以 replay 异常为准并人工审查；
- 可通过 event stream 重建。

## 5. 为什么 Replay 不能只依赖 FinalScoreEvent

`FinalScoreEvent` 是结果记录，不是计算证明。若只信任 final score，将无法发现：

- 事件缺失；
- 维度更新重复；
- 规则终态重复；
- 权重缺失；
- final score 被篡改；
- config checksum 或 engine version 不匹配。

v0.5 replay 必须优先从 DimensionScoreUpdateEvent 重建 breakdown，再用 scoring weights 重算 total score，并与 FinalScoreEvent 对比。

## 6. Persistence Layer Interface

当前新增本地接口：

- `appendEvent(execution_id, event)`
- `getEvents(execution_id)`
- `getExecutionSnapshot(execution_id)`
- `saveSnapshot(execution_id, snapshot)`
- `markReplayConsistency(execution_id, result)`

可选扩展：

- `getExecutionIdByIdempotencyKey(idempotency_key)`
- `reserveIdempotencyKey(idempotency_key, execution_id)`

这些方法定义 future adapter surface，不包含数据库连接或 SQL 执行。

## 7. Engine 集成方式

`scoreLead` 保持向后兼容：

```text
scoreLead(lead, config, executionContext)
```

新增可选 persistence hook：

```text
scoreLead(lead, config, executionContext, { eventStore })
```

行为：

- 未传入 eventStore：继续使用内存 store；
- 传入 eventStore：内存 store 仍保留，同时同步调用 `eventStore.appendEvent`；
- execution 结束后调用 `eventStore.saveSnapshot`；
- 如果 idempotency key 已存在且有 snapshot，直接返回既有结果。

## 8. Replay 来源优先级

`replayExecution(execution_id, { eventStore })` 的来源优先级：

1. DB snapshot：若存在，快速返回 snapshot 结果；
2. event store replay：若没有 snapshot，从 event store events 重放；
3. memory fallback：未启用 eventStore 时使用内存事件。

返回字段新增：

- `persistence_source_used`
- `snapshot_used`

## 9. 未来 n8n 与 API 接入边界

未来 n8n 和 API 只能调用受控 scoring service：

- 不在 n8n 内计算规则；
- 不在 n8n 内直接写 event store；
- API 层负责认证、授权、限流、幂等和 trace id；
- scoring service 负责规则执行、事件生成、snapshot 保存；
- 数据库只保存事实，不作为规则编辑 UI。

进入 n8n / API 接入前必须完成权限、审计、错误处理、重放策略和回滚方案审查。

## 10. 多租户 SaaS Foundation

v0.5 的持久化设计为未来 SaaS 多租户预留：

- `tenant_id` 用于租户边界；
- `organization_id` 用于组织或工作区边界；
- `idempotency_key` 必须按租户唯一；
- 查询必须限定 tenant；
- OLAP 分析不得泄漏跨租户数据。

当前本地实现只保留概念字段，不接真实租户系统。

## 11. 验收标准

- event store schema 已定义；
- persistence layer interface 已抽象；
- PostgreSQL adapter stub 不连接数据库；
- engine 未启用 persistence 时保持旧行为；
- replay 支持 snapshot、event store、memory fallback；
- 测试覆盖 persistence disabled / enabled / snapshot / DB replay / idempotency；
- 不产生生产副作用。

## 12. 风险

- 过早接入真实数据库可能固化错误 schema；
- snapshot 被误用为事实来源会破坏 event sourcing；
- 幂等保护不完整会产生重复 execution；
- event payload 若保存敏感原文会引入合规风险；
- n8n 直接写库会绕过审计和权限边界。

## 13. 回滚原则

当前 v0.5 只新增本地接口、stub 和文档。若需要回滚，可不传入 `eventStore`，系统继续使用内存 store。未来真实数据库实施后，回滚应停止新写入，保留历史 append-only event stream。

## 14. 下一步入口

下一步只能是人工审查 v0.5 schema 与 persistence architecture。进入真实 SQL migration、数据库连接、n8n 接入、API 服务或 Git 归档前，必须获得用户明确批准。
