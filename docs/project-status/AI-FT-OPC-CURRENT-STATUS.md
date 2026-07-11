# AI FT-OPC Current Status

版本：M1-WP02 v1.0
日期：2026-07-11
状态：CURRENT CONTROL STATE — READY_FOR_REVIEW
适用范围：项目当前事实入口
禁止事项：本状态文件不授权数据库、n8n、Docker、服务器、Git 写操作或真实外联。

## Current Milestone

M1 — Production Data Foundation

## Current Work Package

M1-WP02 — Intake Persistence

## Overall State

M0 已完成基线冻结。M0.5-WP01-WP06 已完成，PR #2 已由用户合并到 main。M1-WP01 已通过 PR #3 合并到 main。M1-WP02 已在专用工作分支完成本地 Intake Persistence，等待 CI 与第二层审查；未连接数据库，未创建或执行 SQL migration。

## Recently Completed

- 最新 master architecture v1.0 已在本地工作树中确认。
- Current System Inventory、Interface Map、Commercial v1.0 Gap Register、M1 Plan 与 M0 progress report 已建立。
- 本地 typecheck、Phase 1/2、scoring、orchestration 与 orchestration-scoring 测试通过。
- M0.5-WP01 Project Control Plane 已通过；M0.5-WP02 受限 Git 分支/PR 交付已完成并由用户合并。
- M0.5 已完成并通过 PR CI；受限 Git、Continuation Protocol、只读入口和进度/审批报告已归档。
- M1-WP01 已定义 persistence 逻辑实体、scope、version anchors、敏感字段边界与 DRAFT migration 对齐差距，并已归档。
- M1-WP02 已定义内存 intake run、source item、normalized candidate、tenant-scoped idempotency 和 pending-review 边界。

## Current Baseline

- v0.1 score / grade / priority：当前生产评分事实，v0.2 不得覆盖。
- Phase 1 + Phase 2：本地内存 MVP 可运行。
- v0.2-v0.7 scoring：本地可运行，生产 persistence 未实施。
- orchestration：本地 DAG/event/replay 可运行，非持久化 runtime。
- n8n：仓库存在导出；真实实例和凭据不完整导出。

## Current Blockers

- 无生产 persistence contract、审批后的 migration、真实 PostgreSQL adapter SQL、审计存储或幂等约束。
- 无正式 RBAC/approval、受控 workflow runtime、产品 Dashboard、CRM export、outreach/suppression。

## Pending Approvals

- M1-WP02 的 CI 与第二层审查。
- M1-WP03 Shadow Scoring Persistence 及任何数据库、n8n、服务器、生产或真实外联动作的明确批准。
- 任一 M1 Work Package 的明确范围。
- 数据库 schema/migration 草案评审与未来执行授权。
- 真实单条 shadow 写入、n8n inactive 导入/验证、HTTP server 启动或真实数据接入。

## Latest Test Results

2026-07-11：`typecheck`、`phase1:test`、`phase2:test`、`test:scoring`、`test:orchestration`、`test:orchestration-scoring` 均通过；仅使用本地 memory mode。PowerShell `npm.ps1` 被终端策略阻止，`npm.cmd` 可正常运行。

## Next Work Package

审查 M1-WP02 后，用户可明确批准 M1-WP03 Shadow Scoring Persistence。任何 migration、数据库写入、n8n 激活或生产动作仍需独立 Gate。

## 验收标准

本文件能让新 Agent 在不读取历史全量文档时识别当前阶段、边界、阻塞和下一个批准点。

## 风险

本文件是时间点快照；任何新 migration、n8n 状态或生产变更都必须以新的受审计状态更新覆盖。

## 回滚原则

若基线事实更新，以新的版本替代当前结论，同时保留历史状态文件用于审计。

## 下一步入口

读取最新 master architecture 与对应的经批准 M1 Work Package。
