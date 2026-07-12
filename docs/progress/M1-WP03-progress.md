# M1-WP03 Progress Report

版本：v1.0
日期：2026-07-11
状态：PASSED — PR #5 merged by user
适用范围：Shadow Scoring Persistence（local memory only）。
禁止事项：不连接数据库，不创建、修改或执行 SQL migration，不写 `public.leads`，不激活 n8n，不操作 Docker/服务器，不进行真实外联。

## 已完成

- 定义 shadow persistence envelope，并校验 scope、版本锚点、run mode 和脱敏字段边界。
- 扩展 memory shadow repository：tenant scoped idempotency 和按 result 的 explanation 查询。
- 单条 shadow 流程补齐 run/result 的 outcome policy anchors、validation 摘要、脱敏 explanations 与重复请求复用。
- 对齐 DRAFT-005 的 run/result/diff/explanation 概念，不修改或执行该 SQL 草案。
- 保留 PostgreSQL writer guard/stub，未注入 database client。

## 验证

- `npm.cmd run test:m1-shadow`：6 项通过。
- `npm.cmd run typecheck`：通过。
- `npm.cmd run phase2:test`：13 项通过。
- `npm.cmd run test:scoring`：54 项通过。

## Pull Request

- PR #5 已创建：`feat(shadow): add local M1 shadow persistence`。
- GitHub Actions CI 状态：PASSED；仍需第二层审查和用户批准。

## 已知限制

- 仅内存，重启后 history 丢失。
- 没有数据库事务、唯一约束、RLS/RBAC 或生产级并发处理。
- v0.1 仍是唯一生产评分事实来源；shadow 不写 score、grade、priority。

## 推荐下一步

M1-WP03 已通过。M1-WP04 Review Queue Persistence 已获得明确批准并进入第二层审查。

## 验收标准

有效 shadow write 可按 scope/version 追溯，重复幂等请求不污染 history，preview 无写入，敏感原文不进入结果对象，v0.1 生产事实保持不变。

## 风险

本地 memory 验证不能证明未来 PostgreSQL 的事务、隔离和并发语义；不得把该实现作为生产持久化声明。

## 回滚原则

删除或停用本 WP 的 local-only contract/repository/service 分支即可回滚；不涉及生产数据回滚。

## 下一步入口

M1-WP03 PASSED。
