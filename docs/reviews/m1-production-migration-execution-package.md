# M1 Production Migration Execution Package Review

版本：v1.0
日期：2026-07-15
状态：READY_FOR_REVIEW
适用范围：M1 Production Data Foundation 的 SQL Release Candidate、静态验收和执行前 Runbook。
禁止事项：不执行 SQL、不连接数据库、不写生产数据、不修改 v0.1 trigger/function、不启用 PostgreSQL adapter、n8n、Docker、服务器或真实外联。

## 交付物

- `database/release-candidates/M1-PRODUCTION-DATA-FOUNDATION-v1.sql`：单事务、显式执行的 SQL Release Candidate；
- `database/release-candidates/README.md`：禁止自动发现与执行规则；
- `apps/api-server/m1-production-migration-candidate-tests.ts`：候选 SQL 静态验证；
- `docs/runbooks/M1-PRODUCTION-DATA-FOUNDATION-MIGRATION-RUNBOOK.md`：预检、执行、回滚与停止条件；
- `docs/reviews/m1-production-migration-execution-approval-request.md`：未来执行所需的独立批准模板。

## 已统一的设计

1. 保留既有 `lead_*` 物理命名；DRAFT-005/006/007 原样保留，不作为可执行序列。
2. 新增 11 个 M1 对象均带 `tenant_id`。运行、审核、幂等和审计根对象保留可空 `organization_id`、`actor_user_id`；依赖对象也保留 tenant scope，防止跨租户关系。
3. Shadow、Intake 子对象通过 tenant-scoped 复合外键关联父对象；Review Queue 要求 Shadow Run 与 Shadow Result 同时为空或同时存在，并通过复合外键验证 Result 属于该 Run，且使用 `ON DELETE RESTRICT`。
4. Audit 仅保存经应用验证的关联 ID 和脱敏摘要，不以外键限制审计保留。
5. v0.2 Shadow 记录补齐 execution、trace、idempotency、config checksum、engine 与 outcome policy anchors。
6. Intake candidate 固定为 `pending_review`，不创建正式 Lead，不触碰 `candidate_leads` 或 `public.leads`。

## 静态安全结论

- 候选位于 `database/release-candidates/`，不在现有 `database/migrations/` 路径。
- 候选具有 `BEGIN` / `COMMIT`，没有并发索引，事务失败可自动回滚。
- 候选不含 `ALTER TABLE`、业务表更新、删除性 SQL、trigger/function 创建或 extension 创建。
- 候选没有用于保存完整联系方式、raw_data、HTML、headers、cookies、stack、原始响应、credentials 或 secrets 的字段。
- `uuid-ossp` 是预检前提，候选不擅自创建扩展。

## 本地验收证据

2026-07-15 已在本地运行且全部通过：

- `test:m1-migration-candidate`：6 项候选 SQL 静态检查通过；
- `test:m1-contract`、`test:m1-intake`、`test:m1-shadow`、`test:m1-review`、`test:m1-audit`、`test:m1-idempotency`、`test:m1-migration-draft`：35 项既有 M1 回归通过；
- `typecheck`：通过；
- `validate-project-control`、`validate-safe-state`：通过。

本地自审额外确认并修正了 Review Queue 的同租户关联完整性：现在 Shadow Run 与 Shadow Result 必须同时为空或同时存在，且复合外键确保 Result 属于该 Run；不会出现同租户内跨 Run 的错误配对。

已通过 Git 只读差异检查确认 DRAFT-005、DRAFT-006、DRAFT-007 没有工作树改动；其 SHA-256 分别为：

- `A86EE70ACA2DADA1258A7D08D0C171F6F49C2BDC019568703776336620DA4A18`
- `E60888FC02F96024305B465838C02CF68154620E3D20FDBBED467006E20B84CA`
- `A903DDB3B043F8CCB1628672640121EC6C977BA6D49189F5837F84B683F17318`

## 风险与停止条件

- 当前只读预检确认 11 个目标表不存在，但尚未确认迁移执行角色、备份、执行窗口或 `uuid-ossp` extension 状态；这些均不能由本地代码替代。
- 现有 PostgreSQL adapter 仍是 guard/stub；本包不将其改为真实 SQL。
- 若预检发现目标对象已存在、扩展缺失、权限不足、v0.1 元数据漂移或候选 checksum 不一致，必须停止，不自行修复生产环境。

## 验收标准

- 静态候选测试、既有 M1 回归测试和 TypeScript typecheck 通过。
- DRAFT-005/006/007 的 SHA-256 与实施前基线一致。
- 项目控制面统一记录：只读预检已通过，正式候选待审查，migration execution 未获批准。

## 下一步入口

用户和第二层审查通过本候选包后，才可提出独立的执行批准请求。该请求不自动批准 Shadow Write、adapter 启用、n8n 接入或任何真实外联。
