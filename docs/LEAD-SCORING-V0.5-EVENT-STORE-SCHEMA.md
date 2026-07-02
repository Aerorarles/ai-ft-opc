# Lead Scoring v0.5 Event Store Schema

版本：v0.5-schema-draft
日期：2026-07-01
状态：数据库事件持久化架构草案，仅供审查，不得执行
适用范围：Lead Scoring v0.5 的 PostgreSQL 风格逻辑表、索引、分区、幂等与 replay 一致性设计
禁止事项：本文仅为 SQL 草案级设计，不执行数据库连接，不执行 migration，不创建真实表，不写生产数据，不接 n8n、Docker、服务器或外部 API，不读取 secrets。

## 1. 设计目标

v0.5 的目标是把 v0.4 内存 event stream 升级为可持久化的 event sourcing backend foundation。当前只设计数据结构与接口，不实施数据库变更。

核心原则：

- event store 必须 append-only；
- execution metadata 与 event payload 分离；
- snapshot 只作为快速读取视图，不替代 event stream；
- replay 必须能从 event stream 独立重建分数；
- 所有字段只保存脱敏摘要，不保存 HTML、headers、cookies、stack、原始响应体、API Key、credentials 或 secrets。

## 2. scoring_execution

业务用途：记录一次评分执行的运行上下文，是 event stream 的父记录。

推荐主键：`execution_id`。

逻辑字段：

| 字段 | 类型草案 | 说明 |
| --- | --- | --- |
| execution_id | uuid / text | 主键，执行实例唯一 ID |
| lead_id | uuid nullable | 可选，未来关联 `public.leads` |
| tenant_id | text | 租户边界 |
| organization_id | text nullable | 组织边界 |
| config_version_id | text | 配置版本 ID |
| config_checksum | text | 配置内容校验摘要 |
| outcome_policy_id | text | outcome policy ID |
| outcome_policy_version | text | outcome policy 版本 |
| outcome_policy_checksum | text | outcome policy 校验摘要 |
| engine_version | text | scoring engine 版本 |
| trigger_source | text | api / n8n / manual / replay / shadow |
| run_mode | text | live / shadow / replay / preview |
| idempotency_key | text | 幂等键 |
| request_trace_id | text | 链路追踪 ID |
| created_at | timestamptz | 创建时间 |

SQL 草案，仅供审查，不得执行：

```sql
-- 草案：不得直接执行，需单独审查 migration、影响范围与回滚方案。
CREATE TABLE scoring_execution (
  execution_id uuid PRIMARY KEY,
  lead_id uuid NULL,
  tenant_id text NOT NULL,
  organization_id text NULL,
  config_version_id text NOT NULL,
  config_checksum text NOT NULL,
  outcome_policy_id text NOT NULL,
  outcome_policy_version text NOT NULL,
  outcome_policy_checksum text NOT NULL,
  engine_version text NOT NULL,
  trigger_source text NOT NULL,
  run_mode text NOT NULL,
  idempotency_key text NOT NULL,
  request_trace_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

推荐约束：

- `UNIQUE (tenant_id, idempotency_key)`：防止同租户重复执行。
- `CHECK (trigger_source IN (...))`：限制来源枚举。
- `CHECK (run_mode IN (...))`：限制运行模式枚举。

推荐索引：

- `(tenant_id, created_at DESC)`
- `(lead_id, created_at DESC)`，仅当未来需要按 Lead 查历史。
- `(config_version_id, created_at DESC)`，用于版本影响分析。
- `(request_trace_id)`，用于链路追踪。

## 3. scoring_event_store

业务用途：保存 append-only event stream，是 replay 的事实来源。

推荐主键：`event_id`。

逻辑字段：

| 字段 | 类型草案 | 说明 |
| --- | --- | --- |
| event_id | text / uuid | 主键，事件唯一 ID |
| execution_id | uuid | 父执行 ID，必须索引 |
| event_type | text | 事件类型 |
| sequence_index | integer | 同一 execution 内严格递增 |
| timestamp | timestamptz | 事件时间 |
| config_version_id | text | 配置版本锚点 |
| config_checksum | text | 配置校验锚点 |
| engine_version | text | 引擎版本锚点 |
| payload | jsonb | 脱敏事件内容 |

SQL 草案，仅供审查，不得执行：

```sql
-- 草案：不得直接执行。
CREATE TABLE scoring_event_store (
  event_id text PRIMARY KEY,
  execution_id uuid NOT NULL,
  event_type text NOT NULL,
  sequence_index integer NOT NULL,
  timestamp timestamptz NOT NULL,
  config_version_id text NOT NULL,
  config_checksum text NOT NULL,
  engine_version text NOT NULL,
  payload jsonb NOT NULL
);
```

推荐约束：

- `UNIQUE (execution_id, sequence_index)`：保证事件顺序唯一。
- `UNIQUE (execution_id, event_id)`：防止重复事件。
- `CHECK (sequence_index >= 0)`。

推荐索引：

- `(execution_id, sequence_index)`：replay 主路径。
- `(event_type, timestamp DESC)`：运维审计。
- `(config_version_id, timestamp DESC)`：配置影响分析。
- `GIN (payload)`：仅供低频调试和分析，不应作为核心 OLTP 查询路径。

## 4. scoring_execution_snapshot

业务用途：保存执行结果快照，用于快速读取 UI、API 和报告，不替代 event stream。

逻辑字段：

| 字段 | 类型草案 | 说明 |
| --- | --- | --- |
| execution_id | uuid | 主键，同时引用 scoring_execution |
| total_score | numeric nullable | 最终分数，配置无效时可为 null |
| breakdown | jsonb | 四维度分数 |
| applied_rules | jsonb | 命中规则摘要 |
| skipped_rules | jsonb | 跳过规则摘要 |
| blocked_dimensions | jsonb | 被 blocking 的维度 |
| override_summary | jsonb | override 决策摘要 |

SQL 草案，仅供审查，不得执行：

```sql
-- 草案：不得直接执行。
CREATE TABLE scoring_execution_snapshot (
  execution_id uuid PRIMARY KEY,
  total_score numeric NULL,
  breakdown jsonb NOT NULL,
  applied_rules jsonb NOT NULL,
  skipped_rules jsonb NOT NULL,
  blocked_dimensions jsonb NOT NULL,
  override_summary jsonb NOT NULL
);
```

保存限制：

- 只保存规则摘要和分数摘要；
- 不保存完整 Lead 原文；
- 不保存完整邮箱、电话、HTML、headers、cookies、stack、response 或 secrets。

## 5. scoring_replay_index

业务用途：记录 replay 状态和一致性结果，用于加速审计和发现异常。

逻辑字段：

| 字段 | 类型草案 | 说明 |
| --- | --- | --- |
| execution_id | uuid | 主键 |
| event_count | integer | 事件数量 |
| last_event_timestamp | timestamptz | 最后事件时间 |
| is_consistent | boolean | replay 是否一致 |
| checksum | text | event stream 摘要校验 |

SQL 草案，仅供审查，不得执行：

```sql
-- 草案：不得直接执行。
CREATE TABLE scoring_replay_index (
  execution_id uuid PRIMARY KEY,
  event_count integer NOT NULL,
  last_event_timestamp timestamptz NOT NULL,
  is_consistent boolean NOT NULL,
  checksum text NOT NULL
);
```

## 6. 分区与性能设计

Event store 必须支持两类分区策略，实际采用前需压测和审查：

- time-based partitioning：按月或按周分区，适合归档、冷热分层和 OLAP 扫描；
- execution_id sharding：按 hash 分片，适合高写入吞吐和均匀写入。

推荐早期策略：

- 小规模 shadow 阶段：按时间分区；
- SaaS 多租户高写入阶段：时间分区 + tenant / execution hash 分片；
- replay OLTP 路径只走 `(execution_id, sequence_index)`；
- 分析 OLAP 路径读取只读副本或离线仓库，不阻塞 scoring 写入。

Append-only 优化：

- 不 UPDATE 单条事件；
- 不 DELETE 单条事件；
- 事件纠错通过追加补偿事件或标记 replay index；
- snapshot 可重建，event stream 不可覆盖。

## 7. 幂等与重复执行保护

设计规则：

- `scoring_execution` 使用 `UNIQUE (tenant_id, idempotency_key)`；
- 同一租户、同一 idempotency key 重复请求应返回既有 execution；
- 不允许为同一 idempotency key 创建多个 execution；
- event store 使用 `(execution_id, sequence_index)` 去重；
- adapter 需要在事务内先创建 `scoring_execution`，再 append events；
- 如 append 失败，必须标记 execution 不完整，不得生成成功 snapshot。

## 8. Event Deduplication Strategy

去重层级：

1. `event_id` 主键防重复插入；
2. `(execution_id, sequence_index)` 防同一执行顺序重复；
3. replay 检测同一 `rule_id` 多个终态事件；
4. replay 检测同一 `rule_id` 多个 dimension update；
5. replay 检测 final score 与重算分数不一致。

## 9. Replay Consistency Validation Flow

流程：

1. 读取 `scoring_execution` 上下文；
2. 按 `(execution_id, sequence_index)` 读取 event stream；
3. 校验上下文锚点完整；
4. 根据 DimensionScoreUpdateEvent 重建 breakdown；
5. 使用事件中的 scoring weights 重算 total score；
6. 与 FinalScoreEvent 对比；
7. 写入或更新 `scoring_replay_index`；
8. 若不一致，只标记异常，不修改 event stream。

## 10. OLTP 与 OLAP 读写隔离

OLTP 路径：

- 写入 execution；
- append events；
- 保存 snapshot；
- replay 单条 execution。

OLAP 路径：

- 按 config version 分析差异；
- 按租户分析命中规则分布；
- 统计 replay 异常；
- 评估 shadow score 与 v0.1 的差异。

OLAP 不应直接压迫主写入表，未来应走只读副本、物化视图或离线数据管道。

## 11. 验收标准

- 四张逻辑表职责清晰；
- event store 满足 append-only；
- replay 能依赖 event stream 而不是 snapshot；
- idempotency、去重和一致性校验路径明确；
- 分区和索引策略支持未来扩展；
- 文档不包含可直接执行的生产 migration。

## 12. 风险

- 分区策略过早复杂化会增加维护成本；
- payload 过大可能导致写入和 replay 性能下降；
- snapshot 若被误当作事实来源，会削弱 event sourcing；
- 幂等约束若缺失，可能产生重复 execution。

## 13. 回滚原则

当前仅为设计文档，无生产影响。未来若实施 migration，必须单独提供 SQL、影响范围、回滚方案和用户批准。回滚应优先停止写入新 event store，不删除历史事件。

## 14. 下一步入口

下一步只能是人工审查本 schema 草案。进入真实 SQL migration 设计、数据库连接、n8n 接入或服务器部署前，必须获得用户明确批准。
