# M1 Database Read-only Access Approval Request

版本：v1.1
日期：2026-07-13
状态：COMPLETED_READONLY_PRECHECK
适用范围：M1 生产持久化前的 PostgreSQL 元数据只读预检。
禁止事项：不读取 `.env`、credentials、API Key、Cookie、数据卷或业务客户记录；不执行写入、DDL/DML、migration、trigger/function 变更、n8n、Docker、服务器操作或真实外联。

## 已验证前提

已使用环境外部配置的只读入口完成受限预检：连接到 `127.0.0.1:15432` 的 `aiopc`，当前角色为 `aiopc_readonly`。本次命令行未包含明文密码，且未读取或展示 `pgpass.conf`、`.env` 或任何凭据内容。

## 实际执行的只读查询

以下查询均以 `psql -X -v ON_ERROR_STOP=1` 执行；只访问 PostgreSQL 系统目录或 `information_schema`，未对任何业务表执行 `SELECT`：

1. PostgreSQL 版本、当前 database/user 与 `default_transaction_read_only`；
2. schema 名称列表；
3. `DRAFT-005`、`DRAFT-006`、`DRAFT-007` 对应目标表是否存在；
4. `leads`、`candidate_leads` 及上述草案目标表的列定义；
5. 同一范围内的主键、外键、检查约束和索引定义；
6. `leads`、`candidate_leads` 的非内部 trigger 定义摘要；
7. 当前角色属性、database/schema 权限，以及现存 Lead 表的 `SELECT/INSERT/UPDATE/DELETE` 权限布尔值。

## 结果摘要

- PostgreSQL 版本：16.14；当前 database：`aiopc`；当前角色：`aiopc_readonly`；`default_transaction_read_only=on`。
- 可见 schema：`information_schema`、`pg_catalog`、`public`。
- 已确认生产对象：`public.leads`、`public.candidate_leads`。本次只读取了其结构定义，未读取任何行。
- 已确认 `public.leads` 存在 `leads_score_v01` trigger；它会在指定字段 `INSERT` 或 `UPDATE` 前调用现有 v0.1 评分函数。本次未修改 trigger 或函数。
- `DRAFT-005`、`DRAFT-006`、`DRAFT-007` 中定义的 11 个 shadow、review、intake、idempotency 与 audit 表均不存在，说明草案尚未执行。
- 当前角色不是超级用户，不能创建角色、数据库或 `public` schema 对象；对 `leads` 和 `candidate_leads` 的 `SELECT/INSERT/UPDATE/DELETE` 均为 `false`。

## 结构对齐与风险

- `leads` 已包含 v0.1 评分字段、`raw_data`、enrichment 字段以及 `leads_enrichment_status_check`；现有索引包括 score、grade、priority、status、country、email、product 与 enrichment status。
- `candidate_leads` 已包含来源、候选状态、相关性分数、review notes、结构化分析和 promotion 关联字段；现有网站唯一索引为部分唯一索引。
- 三份 DRAFT migration 的目标对象全部缺失，后续如申请执行，必须先单独审查其与现有 `public.leads`、现有 trigger、索引命名和外键的影响。
- 本次预检不构成 migration execution、写入权限、生产 adapter、n8n、Docker 或服务器操作批准。

## 请求批准的严格范围

仅允许使用管理员已在环境外部配置好的只读连接入口，读取以下元数据：

1. PostgreSQL 版本、当前 database/schema 名称和可用 extension 名称；
2. `public` schema 的表、列、主键、外键、检查约束、唯一约束和索引定义；
3. 当前连接角色对 schema/table 的元数据权限摘要；
4. 与 `DRAFT-005`、`DRAFT-006`、`DRAFT-007` 有关的对象是否已存在，以及命名/字段/约束差异。

允许的输出仅为对象名称、结构摘要、差异、风险、影响范围和回滚建议。不得读取任何业务行、客户资料、原始 Lead、Candidate、Review、Audit 或 Enrichment 内容。

## 明确禁止

- 不读取或展示任何环境变量、密码、连接串、token、credential 或 Cookie；
- 不猜测 host、port、database、user 或认证方式；
- 不运行 `pg_isready` 的连接探测；
- 不执行 `INSERT`、`UPDATE`、`DELETE`、`CREATE`、`ALTER`、`DROP`、`TRUNCATE`、函数/trigger 调整或 migration；
- 不启动 Docker、n8n、服务器或外部 API；
- 不修改 `public.leads`、v0.1 score/grade/priority 或任何生产数据。

## 验收与停止条件

预检完成后必须输出：

- 真实 schema 与 DRAFT-005/006/007 的对齐差异；
- 是否存在 extension、外键、命名、权限、锁表或索引风险；
- 正式 migration 前仍需补齐的事项；
- 独立 migration execution 批准所需的影响范围、回滚草案和执行窗口。

出现权限不足、连接失败、对象冲突、非只读行为提示或任何凭据风险时，立即停止，不尝试绕过或更换认证方式。

## 需要的用户回复

该预检已经在上述严格范围内完成。下一步如需执行任一 DRAFT migration、创建真实 persistence adapter 或进行任何数据库写入，必须提供独立的 SQL、影响范围、回滚方案与执行窗口，并等待新的明确批准。
