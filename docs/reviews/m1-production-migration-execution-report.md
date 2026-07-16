# M1 Production Migration Execution Report

版本：v1.0
日期：2026-07-15
状态：EXECUTED_AND_METADATA_VERIFIED
适用范围：已批准的 M1 Production Data Foundation Release Candidate 的一次受控执行尝试。
禁止事项：本报告不包含备份内容、密码、连接凭据、业务表记录或任何 secrets。

## 执行授权与证据

- 候选文件：`database/release-candidates/M1-PRODUCTION-DATA-FOUNDATION-v1.sql`
- 候选 SHA-256：`F22BFF9EF0AF52F630BC8AF9B09951B6CAF692522B7F3B0F75F11C02E3E34237`
- 目标数据库：`aiopc`，通过已批准的本地入口连接。
- 指定迁移角色：`aiopc_migrator`。
- 备份：`/root/aiopc-backups/aiopc-pre-m1-20260715-183012.dump`
- 备份完成时间：`2026-07-15 18:30:12`
- 备份验证：`pg_dump` exit code 为 0、归档文件非空、`pg_restore --list` 成功；未对生产库执行 restore。
- 备份 SHA-256：`2e02fcd43dfb278bd1630881e97789badcdd3c95eef70f73c392c7528b210c2e`
- 备份及回滚负责人：Jiaolong Li。

## 已完成的执行前预检

- 候选 SHA-256 与审批值一致。
- `current_database()` 为 `aiopc`，`current_user` 为 `aiopc_migrator`。
- `uuid-ossp` 已安装，`uuid_generate_v4()` 可用。
- `public` schema 的 `USAGE` 与 `CREATE` 权限可用。
- `public.leads(id)` 的列级 `REFERENCES` 与 `SELECT` 权限可用。
- `public.leads.id` 已复核为 `uuid`。
- 11 个候选目标表均不存在。

## 执行结果

- 第一次尝试：`2026-07-15 20:04:21 +08:00` 在认证阶段被拒绝，候选 SQL 未开始执行；该失败未造成数据库变更。
- 成功执行时间：`2026-07-15 20:17:28 +08:00`。
- 执行方式：以 `aiopc_migrator` 对已核对 SHA-256 的唯一候选文件执行一次事务。
- 结果：事务成功 `COMMIT`；创建 11 个目标表及候选中定义的约束、索引和注释。
- 复核：11 个目标表均存在；关键 Review Queue 与 Shadow Result 复合关系约束存在；既有 `public.leads` 的 `leads_score_v01` Trigger 定义保持不变。
- 范围：未读取业务表记录，未修改 `public.leads` 业务数据，未执行未列出的 `DROP`、`TRUNCATE`、`DELETE` 或 `UPDATE`。

## 回滚状态

本次成功执行后不自动执行回滚。若尚未有任何 Shadow、Review、Intake 或 Audit 写入，任何空表回滚都必须获得新的独立批准；一旦已有审计或业务写入，应停止 writer、保留历史并采用前向修复，不得自动删除表或审计记录。

## 迁移角色权限回收

数据库管理员已在 migration 成功验证后完成临时权限回收：

- 已撤销 `aiopc_migrator` 的 `CREATE ON SCHEMA public`。
- 已撤销 `public.leads(id)` 的列级 `SELECT` 与 `REFERENCES`。
- `aiopc_migrator` 已设置为 `NOLOGIN`。
- 管理员验证：schema `CREATE=false`、`leads.id SELECT=false`、`leads.id REFERENCES=false`、`rolcanlogin=false`。

本记录仅归档管理员提供的验证结果；本次未再次连接数据库，也未重新授予任何权限。

## 后续审批门

本次 migration 已完成。下一步仅可申请单条、受控的 Shadow Write 批准；不得自动启用 PostgreSQL adapter、Review/Intake writer、n8n、Docker、服务器操作或真实外联。
