# M1-WP04 Review Queue Persistence Design

版本：M1-WP04 v1.0
日期：2026-07-12
状态：READY_FOR_REVIEW
适用范围：仅本地内存 Review Queue、review decision audit、状态机、权限边界与 DRAFT-006 对齐审查。
禁止事项：不连接数据库，不执行或修改 SQL/migration，不写 `public.leads`，不激活 n8n，不操作服务器，不进行真实外联。

## 目标

将 shadow scoring 之后的人工审核作为独立控制点：Review Queue item 表示当前待办状态，Review Decision 表示不可变的终态审计记录。该实现只固定本地接口和行为，不代表数据库 persistence、RBAC 或生产审核流程已经实施。

## 本地状态机

```text
pending -> approved
pending -> rejected
pending -> skipped
```

- 只有 `pending` item 可以产生新的终态 decision。
- 同一 item 的同一 `tenant_id + idempotency_key` 重试返回已有 decision，不新增审计记录。
- 已进入 `approved`、`rejected` 或 `skipped` 的 item 不能用新幂等键再次决策。
- 每次合法终态转换生成一条 append-only `ReviewDecision`；当前 item 只保存最新终态与决策摘要。
- 本 WP 不执行 Candidate Promote，不修改正式 Lead，也不触发外联。

## 必须保留的上下文

### Review Queue Item

- `review_item_id`、`lead_id`、`shadow_run_id`、`shadow_result_id`。
- Scope：`tenant_id`、可选 `organization_id`、可选 `actor_user_id`、`request_trace_id`、`idempotency_key`。
- 决策建议、置信度、理由、风险标记、建议下一步、当前状态、assigned/reviewed identity、时间戳。

### Review Decision

- `review_decision_id`、`review_item_id`、`lead_id`、`shadow_result_id`、`tenant_id`。
- `decision`、`decided_by`、`request_trace_id`、`idempotency_key`、`decided_at`。
- `decision_notes_summary` 只保存非可逆的“是否有备注/长度”摘要，不保存人工备注原文。

## 脱敏与权限边界

- 不保存完整 email、phone、contact_name、raw_data、HTML、headers、cookies、stack、response、credentials、API key、password、token、connection string 或客户原文。
- 本地 MVP 中 `reviewer_id` 是内部标识；未来生产接入必须映射到受认证的 user identity。
- 未来角色边界：operator 可创建/查看 pending item；reviewer 可做一次终态决策；tenant admin/owner 负责授权、复核和审计查询；系统不得以 reviewer 身份代替人工审批。
- 未来 RBAC、RLS、assigned_to 领取语义、SLA 和权限变更审计必须单独设计与批准。

## DRAFT-006 对齐结论

`database/migrations/DRAFT-006-phase2-review-queue.sql` 保持原样、未执行。本地逻辑与其 review queue/decision 概念对齐，并明确未来 migration 草案需补齐：

- tenant、organization、actor、request trace 与统一幂等约束；
- `shadow_run_id` 与 `shadow_result_id` 的一致性约束；
- reviewer identity 的外键/RBAC/RLS 边界；
- append-only decision 与 current item update 的事务语义；
- 安全的备注摘要策略和审计保留策略。

这些是后续 SQL 草案审查输入，不授权创建、修改或执行 SQL。

## 验收标准

- valid review envelope 通过；缺 reviewer identity、非法状态或禁止字段键名被阻断。
- pending item 可进入 approved/rejected/skipped，并生成一条 decision audit。
- 相同幂等键重试复用 decision；不同新键不能改写已终态 item。
- decision note 不保留原文，只保留摘要。
- PostgreSQL review adapter 默认拒绝写入；本 WP 不建立数据库连接。
- `public.leads` v0.1 字段、Shadow scoring 结果和外联边界不受影响。

## 风险

内存实现没有数据库事务、唯一约束、并发锁、RLS/RBAC 或跨进程审计能力。不得把本地自动化测试视为生产人工审批的替代品。

## 回滚原则

本 WP 只新增或扩展 local-only TypeScript contract、memory repository、review service、测试与文档。移除这些变更即可回滚，不涉及生产数据、数据库 schema、n8n、服务器或 v0.1 评分事实。

## 下一步入口

等待 M1-WP04 第二层审查和用户批准。M1-WP05 Audit Foundation 及任何 SQL 草案修改、数据库写入、n8n 或服务器动作均需新的明确授权。
