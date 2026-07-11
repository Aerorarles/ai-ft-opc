# M1-WP02 Intake Persistence Review Pack

版本：v1.0
日期：2026-07-11
状态：READY_FOR_REVIEW
适用范围：M1-WP02 本地内存 Intake Persistence 的审查与验收
禁止事项：未执行数据库连接、migration、n8n、Docker、服务器、真实外联或 main branch merge。

## 已实现

- `MemoryIntakeRepository`：run、source item、candidate 与 tenant-scoped idempotency index。
- `persistIntakeSubmission`：标准化、脱敏、版本 anchor 校验、幂等复用与 pending_review candidate 创建。
- intake contract 扩展：intake 的 normalization/dedup/contract version anchors。
- 本地测试：脱敏、审核状态、幂等、无效 scope 无副作用。

## 未实现

- PostgreSQL adapter、真实数据库表、migration、RLS/RBAC、真实 `candidate_leads` 映射。
- 跨运行持久化、真实 dedup/entity resolution、Candidate Promote、n8n 接入。

## 验收

- `test:m1-intake` 通过。
- `typecheck` 和既有 Phase 1/2、scoring、orchestration 回归通过。
- 不保存完整 email、phone、notes、URL query 或原始 payload。
- 不写生产表或 v0.1 字段。

## Pull Request 状态

- PR #4：`feat(intake): add local M1 intake persistence`。
- 当前 GitHub Actions CI：PENDING。CI 通过后仍需第二层审查与用户批准。

## 风险

内存 repository 只能验证行为契约，不能证明真实数据库事务、约束、索引或并发幂等。

## 回滚原则

移除本 WP 的 local-only 文件和导出即可回滚；无数据库数据回滚需求。

## 下一步入口

等待 M1-WP02 审查与下一 Work Package 的明确批准。
