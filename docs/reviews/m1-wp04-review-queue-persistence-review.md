# M1-WP04 Review Queue Persistence Review Pack

版本：v1.0
日期：2026-07-12
状态：READY_FOR_REVIEW
适用范围：M1-WP04 本地内存 Review Queue Persistence 的代码、契约、测试与 DRAFT-006 对齐审查。
禁止事项：不连接 PostgreSQL，不执行/修改 migration，不写生产 Lead 字段，不修改 n8n、Docker、服务器或真实外联。

## 已实现

- `validateReviewPersistenceEnvelope`：检查 scope、Review item 关联、合法状态、终态决策与 reviewer identity，并拒绝禁止持久化键名。
- `MemoryReviewRepository`：增加 append-only decision history、tenant scoped idempotency、终态防重复和旧接口兼容路径。
- `recordReviewDecision`：创建脱敏 decision summary，更新 current item，并且不执行 promote、scoring 或外联。
- Phase 2 API review action 改用 audited decision service；本地兼容默认 reviewer 仅限 local MVP，生产必须显式认证 identity。
- PostgreSQL review adapter：只补齐 guard/stub 接口；未注入 database client 或执行 query。

## 验收结果

- `test:m1-review`：7 项通过。
- `typecheck`：通过。
- `phase2:test`：13 项通过。
- `test:m1-shadow`：6 项通过。
- 所有验证仅使用本地 memory mode 与 mock Lead snapshot。

## 不变量检查

- 终态只能从 pending 转入，不能用新幂等键重复决策。
- 同一 idempotency key 返回原 decision，不新增审计记录。
- 人工备注原文不进入 item 或 decision persistence 对象。
- 未修改 `public.leads`、v0.1 score/grade/priority、n8n 或外联路径。

## DRAFT-006 审查结论

SQL 草案保持原样、未执行。逻辑实体已对齐；scope、幂等、reviewer identity、事务、RLS/RBAC 和保留策略仍是后续 SQL 草案审查事项。

## 已知限制

- 内存数据在进程重启后丢失。
- 没有数据库事务、锁、RLS/RBAC、跨进程审计或生产级并发处理。
- local reviewer fallback 只能服务既有本地测试，不能作为生产身份认证方案。

## 风险

若未来跳过身份、事务和 audit retention 审查，可能出现越权决策、重复审计或无法证明人工责任的风险。该风险不能由本地 memory 测试消除。

## 回滚原则

撤销本 WP 的本地 TypeScript 与文档变更即可；没有生产数据、数据库 schema 或 v0.1 事实需要回滚。

## 下一步入口

等待 PR、CI、第二层审查与用户批准。M1-WP05 以及任何数据库、SQL、n8n、服务器或真实外联动作必须单独授权。
