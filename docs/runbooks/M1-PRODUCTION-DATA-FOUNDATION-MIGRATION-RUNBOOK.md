# M1 Production Data Foundation Migration Runbook

版本：v1.0
日期：2026-07-15
状态：RELEASE_CANDIDATE_REVIEW_ONLY
适用范围：`M1-PRODUCTION-DATA-FOUNDATION-v1.sql` 的人工审查、未来受控执行与元数据复核。
禁止事项：本 Runbook 不授权数据库连接、SQL 执行、migration、生产写入、n8n、Docker、服务器、Git 写操作或真实外联。

## 目标与不变量

该候选只新增 M1 Shadow、Review、Intake、Idempotency 与 Audit 的 11 个独立表。它不得修改 `public.leads`、v0.1 score/grade/priority、`score_lead_v01()` 或 `leads_score_v01` trigger。

候选仅保存脱敏摘要；禁止持久化完整 email、完整 phone、raw_data、HTML、headers、cookies、stack、原始响应、credentials、secrets 或原始请求体。

## 执行前硬性 Gate

执行人必须在独立授权后，以 metadata-only 查询确认：

1. PostgreSQL 版本与 `public` schema 可用；
2. `uuid-ossp` 已存在，且 `uuid_generate_v4()` 可供迁移执行角色使用；
3. `public.leads(id)` 的实际类型与候选外键兼容；
4. 11 个目标表均不存在；
5. 现有 `leads_score_v01` trigger 仍存在且未被本候选触及；
6. 指定迁移执行角色具备最小 DDL 权限；
7. 人工确认备份、维护窗口、候选文件 SHA-256、回滚负责人和 feature writer 关闭状态。

不得以当前 `aiopc_readonly` 角色的权限推断迁移执行角色的权限，也不得读取任何业务表记录来满足本预检。

## 受控执行顺序

1. 取得单独的 migration execution 批准，批准内容必须绑定候选文件 SHA-256。
2. 人工完成备份与维护窗口确认，保持 Shadow/Review/Intake writer 全部关闭。
3. 由指定执行角色显式运行候选文件；不通过自动目录扫描执行。
4. 若事务失败，数据库自动回滚；停止并记录失败摘要，不自行修改 SQL 重试。
5. 事务提交后，只用系统目录复核新表、列、约束、索引、`uuid-ossp` 与 v0.1 trigger 元数据。
6. 停止，等待新的“单条 Shadow Write”批准；本次执行不启用 adapter、不写入新表。

## 回滚原则

- 事务内失败：依赖 PostgreSQL 事务回滚，不执行补救 DDL。
- 提交后且新表尚无应用写入：仅可在新的明确批准下执行独立的空表回滚候选。
- 已存在审计或业务写入：立即停用 writer，保留历史，使用前向修复；不得自动删除表或审计记录。

## 验收标准

- 只有批准的候选文件被显式执行；DRAFT-005/006/007 未执行。
- 11 个表、tenant 约束、Review 外键、幂等唯一约束与审计唯一约束均可通过元数据复核。
- `public.leads` 定义与 v0.1 trigger 元数据无变化。
- 未读取业务记录，未执行任何外联或工作流激活。

## 下一步入口

候选审查通过后，提交独立的数据库 migration execution 批准请求；没有该批准不得连接执行角色或运行候选 SQL。
