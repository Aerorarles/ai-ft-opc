# AI FT-OPC Current Status

版本：M0-WP01 v1.0
日期：2026-07-11
状态：CURRENT BASELINE
适用范围：项目当前事实入口
禁止事项：本状态文件不授权数据库、n8n、Docker、服务器、Git 写操作或真实外联。

## Current Milestone

M0.5 — Autonomous Delivery Foundation

## Current Work Package

M0.5-WP02 — Restricted Git Automation

## Overall State

M0 已完成基线冻结。M0.5-WP01 已通过并建立控制面。M0.5-WP02 正在以用户批准的专用工作分支模型归档当前控制与基线文档；M1 Production Data Foundation 尚未开始。

## Recently Completed

- 最新 master architecture v1.0 已在本地工作树中确认。
- Current System Inventory、Interface Map、Commercial v1.0 Gap Register、M1 Plan 与 M0 progress report 已建立。
- 本地 typecheck、Phase 1/2、scoring、orchestration 与 orchestration-scoring 测试通过。
- M0.5-WP01 Project Control Plane 已通过；M0.5-WP02 Restricted Git Automation 已获用户明确批准并开始。

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

- M0.5-WP02 的分支、暂存区、PR 与 CI 验证；遇到 Git 冲突、远程分叉、权限异常或敏感文件风险必须停止。
- 任一 M1 Work Package 的明确范围。
- 数据库 schema/migration 草案评审与未来执行授权。
- 真实单条 shadow 写入、n8n inactive 导入/验证、HTTP server 启动或真实数据接入。

## Latest Test Results

2026-07-11：`typecheck`、`phase1:test`、`phase2:test`、`test:scoring`、`test:orchestration`、`test:orchestration-scoring` 均通过；仅使用本地 memory mode。PowerShell `npm.ps1` 被终端策略阻止，`npm.cmd` 可正常运行。

## Next Work Package

完成 M0.5-WP02 后，在不涉及新的高风险权限扩张的前提下，可按 Project Control 状态机继续 M0.5-WP03 GitHub Actions CI；M1 仍以 M1-WP01 Production Persistence Contract 为后续数据基础入口。

## 验收标准

本文件能让新 Agent 在不读取历史全量文档时识别当前阶段、边界、阻塞和下一个批准点。

## 风险

本文件是时间点快照；任何新 migration、n8n 状态或生产变更都必须以新的受审计状态更新覆盖。

## 回滚原则

若基线事实更新，以新的版本替代当前结论，同时保留历史状态文件用于审计。

## 下一步入口

读取最新 master architecture 与对应的经批准 M1 Work Package。
