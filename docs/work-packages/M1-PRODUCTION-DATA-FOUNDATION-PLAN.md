# M1 Production Data Foundation Plan

版本：M0-WP01 输出 v1.0
日期：2026-07-11
状态：待用户批准，不实施
适用范围：从 Local Memory MVP 到 Controlled Production Persistence 的受控计划
禁止事项：本计划不是 migration 执行授权；不连接数据库、不写生产数据、不激活 n8n、不真实外联。

## M1-WP01 Production Persistence Contract

- Objective：冻结 Lead snapshot、shadow run/result/diff、review item、audit 与 version anchor 的接口契约。
- Why Now：当前 `packages/persistence` 内存仓储可运行，PostgreSQL adapter 仍是 placeholder。
- Allowed Scope：只读盘点、TypeScript contract、数据模型文档、SQL 草案审查包。
- Files：`packages/persistence/src/repositories.ts`、`packages/phase2-domain/src/types.ts`、评分 trace/persistence 文档。
- Dependencies：M0 baseline、现有 DRAFT-005/006。
- Tests：接口静态测试、memory repository regression。
- Acceptance Criteria：命名一致、v0.1 不变式明确、敏感字段禁止清单与审计最小字段明确。
- Risks：草案表名与运行模型漂移；tenant/organization/user 关系未冻结。
- Approval Gate：用户批准数据模型与 SQL 草案审查范围。

## M1-WP02 Intake Persistence

- Objective：设计并实现受控的 source item、ingestion run 与 normalized candidate 持久化路径。
- Why Now：当前 ingestion 仅内存，重启丢失且来源不可追溯。
- Allowed Scope：先文档/接口/迁移草案；仅获批后才单条本地写入验证。
- Files：未来 intake domain/repository、migration draft、tests。
- Dependencies：WP01 contract、existing Candidate→Review→Promote 生产边界。
- Tests：normalization、idempotency、来源审计、重复输入。
- Acceptance Criteria：每条输入可追溯，重复执行无污染，不能绕过 candidate review。
- Risks：与现有 candidate_leads 的字段/状态约束冲突。
- Approval Gate：用户批准真实表依赖与 migration 草案。

## M1-WP03 Shadow Scoring Persistence

- Objective：将 shadow run/result/diff/explanation 从内存契约映射为独立、可追溯、不可改写 v0.1 的持久化设计。
- Why Now：本地 scoring/replay 已通过，但无跨重启历史。
- Allowed Scope：DRAFT-005 对齐审查、adapter contract、回滚与单条验证计划。
- Files：`DRAFT-005-*`、shadow repository、scoring persistence interface、tests。
- Dependencies：WP01、config/outcome policy version anchors。
- Tests：preview 不写入、单条 shadow 写入、replay、v0.1 字段不变。
- Acceptance Criteria：按 run/entity/version 追溯；v0.2 不写 `public.leads` 官方评分字段。
- Risks：checksum、outcome policy、trace 与数据库 schema 不一致。
- Approval Gate：用户批准 SQL 草案及单条 shadow write 范围。

## M1-WP04 Review Queue Persistence

- Objective：把内存 review queue 迁移为独立、可审计的 review item/decision 数据模型。
- Why Now：人工 review 是 Candidate→Review→Promote 与 shadow 治理的控制点。
- Allowed Scope：DRAFT-006 审查、状态机/权限文档、adapter interface。
- Files：`DRAFT-006-*`、review repository、review service、tests。
- Dependencies：WP01/WP03。
- Tests：pending→approved/rejected/skipped、不可重复终态、审计记录。
- Acceptance Criteria：不影响 `public.leads` v0.1 字段；队列与决策历史可关联 shadow result。
- Risks：缺 reviewer identity、RBAC 与 SLA。
- Approval Gate：用户批准 review 数据模型和写入测试。

## M1-WP05 Audit Foundation

- Objective：定义跨 intake、shadow、review 的 correlation、事件摘要、最小审计留存与查询边界。
- Why Now：本地 scoring/orchestration 各自有内存 trace，尚无跨模块持久审计。
- Allowed Scope：审计事件契约、禁止字段、查询/保留策略设计。
- Files：audit design、persistence interface、tests。
- Dependencies：WP01-WP04 的实体 ID 与版本锚点。
- Tests：事件顺序、重复事件、最小字段脱敏。
- Acceptance Criteria：按 request_trace_id/run/entity/version 追溯，不保存 HTML、headers、cookies、stack、secrets。
- Risks：过度存储、隐私泄漏、审计不可重放。
- Approval Gate：用户批准持久化审计范围与保留策略。

## M1-WP06 Idempotency & Replay Safety

- Objective：对 intake、shadow run、review action 建立幂等键、重复保护与 replay 一致性原则。
- Why Now：本地 scoring 已有 idempotency/replay；业务层尚未形成统一生产契约。
- Allowed Scope：契约、测试矩阵、failure policy；不执行生产重放。
- Files：persistence contract、shadow/review services、tests、文档。
- Dependencies：WP01/WP05。
- Tests：重复 request、顺序异常、缺失事件、v0.1 不变式。
- Acceptance Criteria：重复执行不污染，失败可解释，replay 不触发 Agent 或外联。
- Risks：跨服务幂等边界不清。
- Approval Gate：用户批准统一 key 语义与重试策略。

## M1-WP07 Migration Draft Review Package

- Objective：汇总并审查经过 WP01-WP06 对齐后的 migration 草案、影响范围、执行前预检、回滚和单条验证方案。
- Why Now：生产数据基础只能在受控、可回滚的变更包下进入实施。
- Allowed Scope：仅 SQL 草案与审查文档；禁止执行。
- Files：新的 DRAFT migration、review pack、rollback plan。
- Dependencies：WP01-WP06 完成并经用户审查。
- Tests：SQL 静态检查、命名/外键/索引审查、无 v0.1 字段写入检查。
- Acceptance Criteria：每个变更有影响范围、预检、rollback、approval gate；无未经批准执行。
- Risks：锁表、FK/extension、历史数据、数据库版本差异。
- Approval Gate：用户明确批准 migration 执行，且需要单独的生产窗口与回滚确认。

## 验收标准

M1 不以“建立更多表”为完成标志，而以服务重启后数据不丢、按 run/entity/version 可追溯、重复执行不污染、v0.2 不影响 v0.1 为 gate。

## 风险

M1 触及数据库事实源；任何写入、migration、真实 n8n 接入都必须在相应 WP 的单独批准后执行。

## 回滚原则

每个 WP 独立可停；DRAFT 与接口设计可撤销。获批实施后必须通过新 migration/feature flag/adapter routing 回滚，不得改写历史 v0.1 事实。

## 下一步入口

建议先由 ChatGPT 第二层审查本计划，再由用户明确批准 M1-WP01。
