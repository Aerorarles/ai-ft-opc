# M1 Production Migration Execution Approval Request

版本：v1.0
日期：2026-07-15
状态：PENDING_USER_APPROVAL
适用范围：未来显式执行 `database/release-candidates/M1-PRODUCTION-DATA-FOUNDATION-v1.sql`。
禁止事项：本请求不授权业务数据读取、Shadow Writer、PostgreSQL adapter 启用、n8n 激活、Docker/服务器操作、真实外联或 Git 写操作。

## 请求的唯一动作

由用户指定的迁移执行角色，在人工确认的维护窗口内，显式执行经 SHA-256 校验的 M1 SQL Release Candidate 一次。

## 执行前必须由人工确认

1. 候选文件 SHA-256：待填写，不得使用未复核文件；
2. 执行角色：待填写，且仅具备本次所需最小 DDL 权限；
3. `uuid-ossp` 与 `uuid_generate_v4()`：将在执行前以 metadata-only 预检确认；
4. 11 个目标表不存在，`public.leads(id)` 兼容，v0.1 trigger 不变；
5. 备份负责人、回滚负责人、维护窗口和停止联系人；
6. Shadow/Review/Intake writer、n8n workflow 与真实外联均保持关闭。

## 执行后允许的复核

仅允许读取系统目录元数据，确认 11 个新表、约束、索引、`uuid-ossp` 和 v0.1 trigger 状态。不得读取业务表记录，不得写入新表或 `public.leads`。

## 明确不包含

- 不批准 `public.leads` 的任何字段、数据、评分、grade、priority、trigger 或函数变更；
- 不批准 PostgreSQL adapter、Shadow Write、Review Write、Intake Write 或 Audit Write；
- 不批准 migration 回滚 DDL；
- 不批准 n8n、Docker、服务器、外部 API、CRM 或客户触达。

## 用户批准语句

如同意，请在确认候选 SHA-256、执行角色、备份/维护窗口和回滚负责人后回复：

`批准执行 M1 Production Data Foundation SQL Release Candidate，仅限已复核 SHA-256 的单事务 DDL，并在执行后停止于元数据复核。`

任何偏离该范围的行为都需要新的明确批准。
