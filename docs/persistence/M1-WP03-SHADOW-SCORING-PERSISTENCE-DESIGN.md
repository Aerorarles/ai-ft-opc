# M1-WP03 Shadow Scoring Persistence Design

版本：M1-WP03 v1.0
日期：2026-07-11
状态：READY_FOR_REVIEW
适用范围：仅本地内存 Shadow Scoring Persistence 合约、验证与 DRAFT-005 对齐审查。
禁止事项：不连接数据库，不执行或修改 SQL/migration，不写 `public.leads`，不修改 v0.1 trigger，不激活 n8n，不操作服务器，不进行真实外联。

## 目标

将既有单条 shadow scoring 的内存结果收敛为可追溯的本地契约：`shadow run`、`shadow result`、`shadow diff` 与脱敏 `shadow explanation` 必须共享 scope、版本锚点和幂等语义。该能力只验证未来持久化所需的行为，不代表 PostgreSQL 已实施。

## 本地流程

```text
ExistingLeadSnapshot
  -> scoreLeadAPI (shadow/preview)
  -> version anchors + sanitized summaries
  -> validateShadowPersistenceEnvelope
  -> tenant scoped idempotency lookup
  -> MemoryShadowRepository
  -> shadow run / result / diff / explanations
  -> pending human review item
```

当 `allow_shadow_write=false` 时，流程只返回 preview 结果，不创建 run、result、diff、explanation 或 review item。

## 必须保留的上下文

- Scope：`tenant_id`、可选 `organization_id`、可选 `actor_user_id`、`request_trace_id`、`idempotency_key`。
- 版本锚点：`config_version_id`、`config_checksum`、`engine_version`、`outcome_policy_id`、`outcome_policy_version`、`outcome_policy_checksum`。
- Shadow 结果：分数、四维 breakdown 摘要、命中规则计数、replay consistency、标准化 inconsistency type、最小 input summary、validation summary。
- Diff：只记录 v0.1 已有评分事实与 shadow score 的摘要比较；不为 v0.2 推导或写入生产 grade/priority。

## 脱敏与不可变边界

- explanation 只保存 rule 标识、规则类型/字段/操作符、维度、delta、weight，以及非可逆的 configured value summary 与已脱敏 actual value summary。
- 不保存完整 email、phone、contact_name、raw_data、HTML、headers、cookies、stack、response、credentials、API key、password、token、connection string 或原始客户输入。
- run/result/diff/explanation 在本地 repository 中仅追加创建；修正应生成新的 shadow run，不覆盖历史事实。
- `public.leads.score`、`grade`、`priority` 与既有 v0.1 trigger/function 不在本 WP 的任何写入路径中。

## 幂等与预览语义

- memory shadow write 使用 `tenant_id + idempotency_key` 查询既有 run；命中时复用既有 run/result/diff，不重新评分、不新增 review item。
- 默认兼容路径在未传入 tenant 时使用受控本地值 `local`；生产接入前必须由调用方显式提供 scope。
- preview 模式没有 persistence 副作用，也不能借由 preview 生成可被当作生产事实的记录。

## DRAFT-005 对齐结论

`database/migrations/DRAFT-005-lead-scoring-v0.2-shadow-mode.sql` 仍是未执行的 SQL 草案，本 WP 不修改它。当前本地逻辑与其 `lead_scoring_shadow_runs/results/diff/explanations` 概念对齐，并额外明确了后续数据库设计必须补齐的内容：

- 租户、组织、操作者和统一幂等键；
- `outcome_policy_id` 与完整 outcome policy checksum；
- config version 的逻辑 ID 与物理字段映射；
- 只读 replay/audit 查询边界及并发唯一约束。

这些差距只作为后续 migration 草案审查输入，不授权创建、修改或执行 SQL。

## 验收标准

- 有效 shadow envelope 通过；缺少版本锚点或出现禁止键名时被阻断。
- memory shadow write 保留完整 scope/version anchors 并生成脱敏 explanations。
- 同一 tenant/idempotency key 不产生重复 run、history 或 review item。
- preview 不写入 memory shadow repository。
- v0.1 score、grade、priority 在 shadow 执行前后不变。
- PostgreSQL adapter 仍由 guard 默认拒绝写入，且本 WP 不调用它。

## 风险

内存 repository 不具备跨进程存储、数据库事务、唯一约束或并发保护能力。它只用于固定本地接口和验证行为，不能被描述为生产 persistence。

## 回滚原则

本 WP 只新增或扩展本地 TypeScript contract、memory repository、测试与文档。移除这些本地代码即可回滚，不涉及生产数据、数据库 schema、n8n、服务器或 v0.1 评分事实。

## 下一步入口

等待 M1-WP03 第二层审查和用户批准。M1-WP04 Review Queue Persistence 及任何 SQL 草案修改、数据库写入、n8n 或服务器动作均需新的明确授权。
