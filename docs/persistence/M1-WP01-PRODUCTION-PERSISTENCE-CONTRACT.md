# M1-WP01 Production Persistence Contract

版本：M1-WP01 v1.0
日期：2026-07-11
状态：READY_FOR_REVIEW
适用范围：生产持久化前的逻辑实体、接口、版本锚点、脱敏与不变式契约
禁止事项：本文件不包含可执行 SQL，不授权数据库连接、migration、生产写入、n8n 激活、服务器操作或真实外联。

## 1. 目标

冻结从 Local Memory MVP 迁移到 Controlled Production Persistence 前必须共同遵守的逻辑契约。它不实现数据库，不替代 DRAFT migration，也不改变 v0.1 生产评分事实。

## 2. 逻辑实体

| 逻辑实体 | 当前本地对应 | 未来职责 | 是否不可变 |
| --- | --- | --- | --- |
| `lead_snapshot` | `ExistingLeadSnapshot` | 单条 Lead 的脱敏只读评分输入快照 | 是，按运行时刻固定 |
| `shadow_scoring_run` | `ShadowRun` | 一次 shadow 运行上下文 | 是，状态变化以审计事件补充 |
| `shadow_scoring_result` | `ShadowResult` | 单 Lead 的 shadow 分数与版本锚点 | 是 |
| `shadow_scoring_diff` | `ShadowDiff` | v0.1 与 v0.2 的差异摘要 | 是 |
| `review_queue_item` | `ReviewQueueItem` | 人工复核任务 | 当前状态可变，决策历史不可变 |
| `review_decision` | DRAFT-006 概念实体 | append-only 人工决策记录 | 是 |
| `audit_event` | scoring/orchestration 内存事件 | 跨模块最小审计摘要 | 是，append-only |

逻辑名称是 M1 的稳定接口名；它们不等同于后续物理表名。

## 3. 每次持久化必须具备的上下文

### Scope

- `tenant_id`：必填；当前本地可使用受控 local 值，未来不可省略。
- `organization_id`：可空；为未来组织边界预留。
- `actor_user_id`：可空；人工/系统动作的身份锚点。
- `request_trace_id`：必填；跨 intake、score、review 的链路关联。
- `idempotency_key`：必填；同一租户内避免重复污染。

### Version Anchors

- `config_version_id`
- `config_checksum`
- `engine_version`
- `outcome_policy_id`
- `outcome_policy_version`
- `outcome_policy_checksum`

以上字段必须与每个 shadow run/result 和审计摘要关联，才能重放历史结果并解释跨版本差异。

## 4. 不可破坏的不变式

1. `public.leads` 的 v0.1 `score`、`grade`、`priority` 仍是生产事实；v0.2 只能 shadow。
2. Candidate → Review → Promote 不得绕过。
3. 评分/审核历史不可通过覆盖旧记录改写；修正必须创建新版本或追加审计事件。
4. 同一 `tenant_id + idempotency_key` 只允许代表一个逻辑执行。
5. `replay_consistency=false`、无效配置或缺少版本锚点必须进入人工复核，不得伪造成功。
6. PostgreSQL adapter 在获批真实实现前仍只能是 guard/stub，不得被当作可用生产写入器。

## 5. 脱敏和禁止存储

允许持久化：ID、状态、版本/校验摘要、国家、行业、布尔存在性、计数、分数/差异/规则摘要、审核结论、最小审计元数据。

禁止持久化：完整 email、完整 phone、contact_name、raw_data、HTML、headers、cookies、stack、response、credential、API key、password、token、connection string 及原始客户敏感正文。

`packages/persistence/src/production-persistence-contract.ts` 提供纯本地的 envelope 校验，检测禁止键名而不回显任何值。

## 6. 现有资产与对齐结果

| 资产 | 当前状态 | M1-WP01 结论 |
| --- | --- | --- |
| memory repositories | 可运行 | 作为行为基线保留；不假装生产持久化。 |
| PostgreSQL adapters | guard/stub | 保留接口面，真实 SQL 留给获批后 WP。 |
| DRAFT-005 | `lead_scoring_shadow_*` 物理命名 | 逻辑映射到 `shadow_scoring_*`；不在本 WP 改 SQL。 |
| DRAFT-006 | `lead_review_queue/decisions` 物理命名 | 逻辑映射到 `review_queue_item/review_decision`；不在本 WP 改 SQL。 |
| v0.5 event schema | `scoring_execution/event_store/snapshot` | 作为评分审计/重放的独立子域，不能与 shadow run 混为同一事实表。 |

## 7. 已识别的 migration 对齐差距

- DRAFT-005/006 缺少明确的 `tenant_id`、`organization_id`、`actor_user_id` 与统一 `idempotency_key` 策略。
- master architecture 中的逻辑实体命名与 DRAFT 物理表名尚未冻结。
- review 状态、审核者身份和 append-only decision audit 的最终约束需在 WP04/WP05 继续对齐。
- shadow result 的版本锚点已有部分字段，但 outcome policy、审计关联和重放边界仍需统一。

这些是后续 WP 的审查输入，不是本 WP 执行 migration 的理由。

## 8. 验收标准

- 逻辑实体、scope、version anchors、敏感字段边界和 v0.1 不变式明确。
- TypeScript 本地契约能拒绝缺失锚点与禁止键名。
- 现有 DRAFT migration 的命名/字段差距被记录，不修改任何 SQL。

## 风险

若未在 WP07 前冻结物理命名、租户边界和幂等约束，后续 migration 可能产生跨版本数据漂移或重复写入风险。

## 回滚原则

本 WP 只增加本地 contract、测试与文档。回滚可移除这些文件/导出，不影响数据库、v0.1 事实、n8n 或生产数据。

## 下一步入口

等待 M1-WP01 第二层审查。后续 M1-WP02、WP03 等需要各自明确批准。
