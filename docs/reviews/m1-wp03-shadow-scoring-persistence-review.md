# M1-WP03 Shadow Scoring Persistence Review Pack

版本：v1.0
日期：2026-07-11
状态：READY_FOR_REVIEW
适用范围：M1-WP03 本地内存 shadow persistence 的代码、契约、测试和 DRAFT-005 对齐审查。
禁止事项：不连接 PostgreSQL，不执行/修改 migration，不写生产 Lead 字段，不修改 n8n、Docker、服务器或真实外联。

## 已实现

- `validateShadowPersistenceEnvelope`：检查 scope、六个评分版本锚点、`shadow` run mode 与禁止持久化键名。
- `MemoryShadowRepository`：增加 tenant scoped idempotency 查询和按 result 查询脱敏 explanations。
- `runSingleLeadShadow`：在 memory write 前验证 envelope，保存 run/result/diff/explanations，并在幂等命中时复用既有结果。
- `scoreLeadAPI`：向安全 replay metadata 公开 config、engine 和 outcome policy anchors，未改变评分公式、规则或权重。
- PostgreSQL shadow adapter：只补齐接口占位方法；写入 guard 保持默认拒绝，未建立数据库连接。

## 验收结果

- `test:m1-shadow`：6 项通过。
- `typecheck`：通过。
- `phase2:test`：13 项通过。
- `test:scoring`：54 项通过。
- 所有验证仅使用本地 memory mode 与 mock lead snapshot。

## Pull Request 状态

- PR #5：`feat(shadow): add local M1 shadow persistence`。
- 当前 GitHub Actions CI：PENDING。CI 通过后仍需第二层审查与用户批准。

## 不变量检查

- v0.1 `score`、`grade`、`priority` 未被 shadow 执行改写。
- preview 不创建 shadow history、explanations 或 review item。
- 同 tenant/idempotency key 不创建重复 shadow run 或 review item。
- 结果与 explanations 不保留完整 email/phone、raw input、HTML、headers、cookies、stack 或 secrets。

## DRAFT-005 审查结论

SQL 草案保持原样、未执行。逻辑实体已对齐；tenant scope、idempotency、outcome policy ID 和并发唯一约束仍是后续 SQL 草案审查事项。

## 已知限制

- 内存数据在进程重启后丢失。
- 没有事务、锁、RLS/RBAC、跨进程 replay 或数据库唯一约束。
- PostgreSQL adapter 仍是 guard/stub，不可作为生产 writer。

## 风险

若未来跳过正式 migration 审查，可能出现 scope 泄漏、重复写入或版本锚点无法重放。该风险不能由本地 memory 测试消除。

## 回滚原则

撤销本 WP 的本地 TypeScript 与文档变更即可；没有生产数据、数据库 schema 或 v0.1 事实需要回滚。

## 下一步入口

等待 PR、CI、第二层审查与用户批准。M1-WP04 以及任何数据库、SQL、n8n、服务器或真实外联动作必须单独授权。
