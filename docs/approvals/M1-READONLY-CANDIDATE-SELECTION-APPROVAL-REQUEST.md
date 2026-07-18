# M1 Read-only Candidate Selection Approval Request

版本：v1.0
日期：2026-07-16
状态：`APPROVED_READ_ONLY`

批准人：Owner
批准时间：`2026-07-16T03:28:38.7539347Z`
批准证据：用户在收到“最多 3 条、最小字段、只读候选筛选，且不包含 writer 或数据库写入”的明确下一动作后回复“继续下一步”。

## 请求目的

为首次单 Lead Shadow Write 选择最多 3 条合格候选。该请求不包含 writer role、数据库写入、schema/migration、Review Queue、Intake、n8n、Docker、服务器或外联。

## 请求的最小读取范围

- 身份：既有 `aiopc_readonly`，事务必须为 `READ ONLY`。
- `public.leads`：`id`、`company_name`、`website`、`country`、`industry`、email/phone 是否为空的布尔表达式、`score`、`grade`、`priority`、`enrichment_status`、`status`、`source`。
- `public.lead_scoring_shadow_results`：仅用于判断同 tenant/Lead/config/engine 是否已有结果。
- `public.lead_operation_idempotency_claims`：仅用于判断该 Lead 是否已有 Shadow claim。
- 最大输出：3 条候选摘要。

## 明确不读取/不输出

不读取/输出 `contact_name`、`contact_title`、完整 email、完整 phone、`notes`、`raw_data`、HTML、headers、cookies、response、stack、credentials 或其他业务原文。email/phone 仅在数据库表达式中转为 presence boolean，不返回原值。

## 排除与停止条件

排除 competitor、已知历史技术样本、rejected、suppressed/do-not-contact、测试来源、最小评分输入不足、已有相同 Shadow 范围或幂等 claim 的 Lead。权限不足、字段/表/版本漂移、返回超过 3 条、出现敏感字段或无法证明排除规则时立即停止，候选结果为 0。

## 输出与下一门

输出仅包含 skill 允许的候选摘要、candidate evidence hash 和 input snapshot hash。用户选择一个候选后才生成新的 `PENDING_APPROVAL` Shadow 请求；本只读批准不能被解释为写入批准。
