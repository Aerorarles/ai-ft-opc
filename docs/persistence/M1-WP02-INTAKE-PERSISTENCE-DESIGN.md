# M1-WP02 Intake Persistence Design

版本：M1-WP02 v1.0
日期：2026-07-11
状态：READY_FOR_REVIEW
适用范围：本地内存 intake run、source item、normalized candidate 与幂等契约
禁止事项：不连接数据库、不创建或修改 SQL migration、不写 `candidate_leads`/`public.leads`、不激活 n8n、不执行外联。

## 目标

为任何未来来源建立受控的本地 intake 路径：输入先标准化，再形成脱敏 source item 和 `pending_review` candidate。它不 promote Candidate，不创建 Formal Lead，也不替代未来 PostgreSQL persistence。

## 本地流程

```text
LeadInput
→ normalizeLead
→ validate intake scope/version anchors
→ idempotency lookup
→ intake_run
→ sanitized source_item
→ normalized candidate (pending_review)
→ completed intake_run
```

## 实体与字段边界

| 实体 | 保留字段 | 明确不保存 |
| --- | --- | --- |
| IntakeRun | tenant、organization/actor、trace、idempotency、trigger、版本、计数、状态 | 原始 payload、email、phone、notes、secrets |
| IntakeSourceItem | source type、无 query/fragment 的 source URL、payload hash、布尔摘要 | 原 URL query、原始响应、HTML、cookie、headers、token |
| IntakeCandidateRecord | company_name、domain、country、industry、has_email、has_phone、signals、normalization summary、pending_review | 完整 email、phone、notes、raw_data、联系人信息 |

## 幂等与审核边界

- 幂等键按 `tenant_id + idempotency_key` 查询；相同键返回已存在的 run，不新建 source item/candidate。
- Candidate 固定为 `pending_review`，dedup 状态为 `not_evaluated`。
- 本 WP 不写 `candidate_leads`、不写 `public.leads`，不调用 Promote，不触发 scoring 或外联。

## 当前与未来边界

当前实现是 `MemoryIntakeRepository`，用于行为验证和接口稳定性。未来数据库实现必须复用 M1-WP01 scope、版本、脱敏和 idempotency contract，并在单独批准的 migration review 后才可连接 PostgreSQL。

## 验收标准

- 标准化 candidate 进入 pending_review。
- source URL 删除 query/fragment，敏感字段不进入持久化对象。
- 相同 tenant/idempotency key 不产生重复记录。
- 无效 scope 在任何 repository 变更前被阻断。

## 风险

当前 dedup 只标记 `not_evaluated`；实体解析与真实 Candidate 表映射必须由后续受控 Work Package 处理。

## 回滚原则

本 WP 仅新增内存 repository、local service、测试和文档。移除这些文件不影响生产数据库或 v0.1 事实。

## 下一步入口

等待 M1-WP02 第二层审查。M1-WP03 Shadow Scoring Persistence 需新的明确批准。
