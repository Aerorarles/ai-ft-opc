# Lead Scoring v0.2 Shadow Writer Contract

版本：v0.1
日期：2026-07-02
状态：执行前接口草案，禁止直接实施
适用范围：v0.2 Shadow Mode 写入独立 shadow 表的输入、输出、安全边界和验收标准
禁止事项：不得写 `public.leads` 正式评分字段；不得执行真实外联；不得更新 `raw_data.enrichment_v01`；不得保存 secrets 或原始敏感数据。

## 1. Contract 目标

Shadow Writer 的职责是把 v0.2 本地评分结果保存到独立 shadow 表，并生成 v0.1 与 v0.2 的差异记录。它不是正式评分写入器，不得成为 v0.1 的替代路径。

## 2. 输入

必需输入：

- `lead_id`
- sanitized lead fields
- v0.1 `score`
- v0.1 `grade`
- v0.1 `priority`
- `config_version`
- `config_checksum`
- `engine_version`
- `run_mode = shadow`
- `request_trace_id`

允许的 sanitized lead fields：

- `company_name` 是否存在或简短非敏感名称摘要；
- `website` 是否存在，必要时仅保存域名摘要；
- `country`
- `industry`
- `has_email`
- `has_phone`
- `signals_count`
- `industry_keywords_count`
- `enrichment_status`
- `has_company_description`
- `has_contact_page_url`

禁止输入或持久化：

- 完整 email；
- 完整 phone；
- 完整 contact_name；
- raw_data 原文；
- HTML；
- headers；
- cookies；
- stack；
- response；
- credentials；
- API Key；
- 数据库连接串；
- 客户敏感正文。

## 3. 输出

Shadow Writer 输出：

- `shadow_run_id`
- `shadow_result_id`
- `shadow_score`
- `breakdown`
- `applied_rule_count`
- `replay_consistency`
- `inconsistency_type`
- `score_delta`
- `requires_review`
- `diff_summary`

其中：

- `shadow_score` 不得写回 `public.leads.score`；
- `breakdown` 只保存维度摘要；
- `diff_summary` 只保存脱敏比较结果；
- `requires_review=true` 表示必须人工复核，不代表正式评分改变。

## 4. 安全边界

Shadow Writer 必须遵守：

- 禁止写 `public.leads.score`；
- 禁止写 `public.leads.grade`；
- 禁止写 `public.leads.priority`；
- 禁止写 `public.leads.lead_score_breakdown`；
- 禁止写 `public.leads.last_scored_at`；
- 禁止修改 `score_lead_v01()`；
- 禁止修改 `leads_score_v01`；
- 禁止执行任何客户外联；
- 禁止更新 `raw_data.enrichment_v01`；
- invalid config 必须阻断；
- `replay_consistency=false` 时必须 `requires_review=true`；
- shadow 写入失败不得影响 v0.1 生产路径。

## 5. Diff 规则

最小 diff 逻辑：

- `score_delta = shadow_score - v01_score`
- 若缺少 versioned outcome policy，则 `grade_diff_status = not_evaluated`
- 若缺少 versioned outcome policy，则 `priority_diff_status = not_evaluated`
- 若 `ABS(score_delta)` 超过人工确认阈值，则 `requires_review = true`
- 若 config validation failed，则 `requires_review = true`
- 若 replay consistency false，则 `requires_review = true`

## 6. 单条 Shadow Run 验收

单条验收必须确认：

- v0.1 正式字段运行前后值一致；
- shadow 表存在独立记录；
- diff 可查；
- explanation 仅包含脱敏摘要；
- `replay_consistency=true`；
- invalid config 不生成伪成功评分；
- 失败不影响 v0.1；
- 可独立停用 shadow writer。

## 7. 错误处理

- scoring validation error：写入 blocked / invalid shadow result 或停止写入，由人工复核。
- replay inconsistency：允许保存 shadow result，但必须 `requires_review=true`。
- shadow DB insert 失败：停止 shadow workflow，显示错误，不触碰 `public.leads`。
- duplicate run：依赖 `request_trace_id` 或后续幂等键策略去重，当前草案不自动覆盖历史。

## 8. 回滚方式

- 停用 shadow workflow；
- 停用 Shadow Writer；
- 保留或按批准归档 shadow 表数据；
- 不修改 `public.leads`；
- 不修改 v0.1 trigger；
- 不修改 v0.1 function；
- 不需要生产数据回滚。

## 9. 下一步入口

执行前必须由用户批准：

- 正式 migration SQL；
- n8n workflow 导入但保持 inactive；
- 单条 Lead shadow run；
- 后续小批量 shadow run。
