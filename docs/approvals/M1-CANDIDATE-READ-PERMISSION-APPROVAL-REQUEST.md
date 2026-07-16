# M1 Candidate Read Permission Approval Request

版本：v1.0
日期：2026-07-16
状态：`PENDING_OWNER_APPROVAL`

## 目的

为 `aiopc_readonly` 临时补齐一次最多 3 条 Shadow 候选筛选所需的列级 SELECT 权限。该批准不包含数据库写入、writer role、schema、n8n、服务器或外联。

## 精确授权 SQL

由数据库管理员在受控窗口执行；Skill 不自动执行 GRANT：

```sql
GRANT SELECT (
  id, company_name, score, grade, priority, enrichment_status, status,
  website, country, industry, email, phone, source
) ON TABLE public.leads TO aiopc_readonly;

GRANT SELECT (
  tenant_id, lead_id, config_version, engine_version
) ON TABLE public.lead_scoring_shadow_results TO aiopc_readonly;

GRANT SELECT (
  tenant_id, operation_type, entity_id
) ON TABLE public.lead_operation_idempotency_claims TO aiopc_readonly;
```

## 使用范围

- endpoint：`127.0.0.1:15432 / aiopc`；
- identity：`aiopc_readonly`；
- transaction：`BEGIN READ ONLY ... ROLLBACK`；
- 最多输出 3 条允许摘要及 evidence/input hash；
- email/phone 仅转换为 presence boolean，不返回原值；
- 排除 competitor、历史技术样本、rejected、suppressed、测试来源、输入不足及已使用 Shadow/幂等范围。

## 撤销 SQL

候选筛选和新请求生成完成后立即由数据库管理员执行：

```sql
REVOKE SELECT (
  id, company_name, score, grade, priority, enrichment_status, status,
  website, country, industry, email, phone, source
) ON TABLE public.leads FROM aiopc_readonly;

REVOKE SELECT (
  tenant_id, lead_id, config_version, engine_version
) ON TABLE public.lead_scoring_shadow_results FROM aiopc_readonly;

REVOKE SELECT (
  tenant_id, operation_type, entity_id
) ON TABLE public.lead_operation_idempotency_claims FROM aiopc_readonly;
```

## 验证与停止条件

- 授权前后使用 `has_column_privilege` 验证精确列权限；
- 确认没有 INSERT、UPDATE、DELETE、TRUNCATE、REFERENCES、TRIGGER 或 DDL 权限；
- 权限、schema 或输出范围任何一项不一致立即停止；
- 不允许通过扩大为整表写权限或管理员身份绕过。

## Owner 批准格式

批准时必须明确回复本文件版本和以下范围：

`APPROVE M1-CANDIDATE-READ-PERMISSION v1.0 / aiopc_readonly / three tables column-level SELECT / max 3 candidates / revoke after request`
