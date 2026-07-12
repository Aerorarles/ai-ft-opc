# M1-WP02 Progress Report

版本：v1.0
日期：2026-07-11
状态：PASSED — PR #4 merged by user
适用范围：Intake Persistence（local memory only）
禁止事项：不连接数据库、不创建或执行 SQL migration、不写 `candidate_leads`/`public.leads`、不修改 n8n、Docker、服务器或真实外联。

## Objective

建立受控 intake run、脱敏 source item、normalized candidate 和 tenant-scoped idempotency 的本地内存基线，确保新来源不会绕过 Candidate Review。

## Completed

- 新增 `MemoryIntakeRepository`。
- 新增 `persistIntakeSubmission`，完成标准化、scope/version 验证、幂等复用、source item/candidate 创建与 run 完成状态。
- Candidate 固定为 `pending_review`，dedup 为 `not_evaluated`；不触发 Promote、scoring、外联或生产写入。
- source URL 移除 query/fragment；持久化对象不保存完整 email、phone、notes 或原始 payload。
- 扩展 production contract，加入 intake normalization/dedup/contract version anchors。

## Validation

- `npm.cmd run test:m1-intake` 通过：脱敏、pending_review、幂等、无效 scope 无副作用。
- `npm.cmd run test:m1-contract`、`typecheck`、Phase 1/2、scoring、orchestration、orchestration-scoring 回归均通过。
- 未连接数据库、未执行 SQL。

## Pull Request

- PR #4 已创建：`feat(intake): add local M1 intake persistence`。
- GitHub Actions CI 状态：PASSED，且 PR #4 已由用户合并到 main。

## Known Limitations

- 仅内存，进程重启后不保留 run/source item/candidate。
- 不映射真实 `candidate_leads`，不做真实 dedup/entity resolution，不实现 RBAC/RLS。
- 真实 PostgreSQL schema、事务、唯一约束、索引和 migration 顺序留给后续批准的 Work Package。

## Recommended Next

M1-WP02 已通过。M1-WP03 Shadow Scoring Persistence 已获得明确批准并进入第二层审查。

## 验收标准

来源输入被标准化并进入 pending_review，重复幂等请求不污染，敏感字段不进入本地持久化对象，且 v0.1 生产事实不受影响。

## 风险

内存验证不能证明数据库并发与事务语义；不得将其误写为生产 intake 功能。

## 回滚原则

移除 local-only intake package/repository/test/doc 即可回滚，无生产数据副作用。

## 下一步入口

M1-WP02 PASSED。
