# Lead Scoring v0.2 Shadow Mode 最小落地设计

版本：v0.1
日期：2026-07-02
状态：设计草案，禁止直接执行
适用范围：Lead Agent v0.1 生产评分事实来源旁路运行 v0.2 shadow scoring
禁止事项：不得执行本文 SQL 草案；不得写 `leads.score`、`leads.grade`、`leads.priority`；不得修改 v0.1 trigger/function；不得导入、发布或激活 n8n workflow；不得读取 secrets。

## 1. 目标

v0.2 shadow mode 只做：

- 读取单条或受控小批量 Lead；
- 使用 v0.2 scoring engine 计算 shadow score；
- 保存独立 shadow result、explanation、run metadata；
- 与 v0.1 score 做差异比较；
- 输出人工可复核报告；
- 不替代 v0.1 生产评分。

明确禁止：

- 不写 `public.leads.score`；
- 不写 `public.leads.grade`；
- 不写 `public.leads.priority`；
- 不修改 `score_lead_v01()`；
- 不修改 `leads_score_v01`；
- 不自动触达客户；
- 不进行全量自动重评分。

## 2. 数据流

建议最小数据流：

1. n8n 或本地任务读取 `public.leads` 的单条 Lead。
2. 构造脱敏 scoring input summary。
3. 调用 v0.2 scoring capability。
4. 生成 shadow result。
5. 写入独立 shadow 表。
6. 读取 v0.1 当前 `score`、`grade`、`priority`。
7. 生成 diff record。
8. 人工审查。

v0.1 正式路径保持不变：

`n8n / manual input -> public.leads -> score_lead_v01 trigger -> score / grade / priority`

v0.2 shadow 路径：

`Lead read-only input -> scoreLeadAPI / scoring runtime -> shadow tables -> diff report`

## 3. 最小数据模型草案

### 3.1 `lead_scoring_shadow_runs`

业务用途：记录一次 v0.2 shadow scoring 执行批次或单条运行上下文。

推荐字段：

- `shadow_run_id`
- `run_mode`
- `trigger_source`
- `requested_by`
- `config_version`
- `config_checksum`
- `engine_version`
- `outcome_policy_version`
- `run_status`
- `lead_count`
- `started_at`
- `completed_at`
- `error_summary`
- `created_at`

与 `public.leads` 的关系：不直接保存 Lead 内容；由 results 表按 `lead_id` 关联。

不得保存：完整 email、phone、HTML、headers、cookies、stack、原始响应体、API Key、credentials、数据库连接信息。

索引建议：

- `run_status`
- `created_at`
- `config_version`
- `engine_version`

回滚方式：停用 shadow writer；按用户批准归档或删除 shadow run 记录；不修改 `public.leads`。

Retention：建议设置保留期，例如 90-180 天，或按人工审核完成后归档。

### 3.2 `lead_scoring_shadow_results`

业务用途：记录某个 Lead 在某次 shadow run 下的 v0.2 评分结果。

推荐字段：

- `shadow_result_id`
- `shadow_run_id`
- `lead_id`
- `shadow_score`
- `breakdown`
- `applied_rule_count`
- `config_version`
- `config_checksum`
- `engine_version`
- `replay_consistency`
- `inconsistency_type`
- `input_summary`
- `created_at`

与 `public.leads` 的关系：`lead_id` 引用 `public.leads.id`，但不写回 `public.leads`。

不得保存：完整 Lead 原文、完整邮箱、完整电话、HTML、headers、cookies、stack、原始 scoring event stream、API Key、credentials。

索引建议：

- `lead_id`
- `shadow_run_id`
- `config_version`
- `shadow_score`
- `created_at`

回滚方式：删除或归档 shadow result；不影响 `public.leads`。

### 3.3 `lead_scoring_shadow_diff`

业务用途：记录 v0.1 正式评分与 v0.2 shadow scoring 的差异。

推荐字段：

- `shadow_diff_id`
- `shadow_result_id`
- `lead_id`
- `v01_score`
- `v01_grade`
- `v01_priority`
- `shadow_score`
- `score_delta`
- `grade_diff_status`
- `priority_diff_status`
- `requires_review`
- `diff_summary`
- `created_at`

注意：如果没有 versioned outcome policy，不输出 grade / priority diff，只输出 score diff。

索引建议：

- `lead_id`
- `requires_review`
- `score_delta`
- `created_at`

回滚方式：删除或归档 diff 记录；不影响 v0.1 正式字段。

### 3.4 可选：`lead_scoring_shadow_explanations`

业务用途：保存每条命中规则的脱敏解释摘要，供人工审查。

推荐字段：

- `shadow_explanation_id`
- `shadow_result_id`
- `rule_id`
- `rule_type`
- `field`
- `operator`
- `dimension`
- `raw_delta`
- `weight`
- `effective_delta`
- `actual_value_summary`
- `expected_value_summary`
- `created_at`

不得保存：完整邮箱、完整电话、HTML、headers、cookies、stack、原始响应体、完整规则原值、secrets。

索引建议：

- `shadow_result_id`
- `rule_id`
- `dimension`

回滚方式：随 shadow result 一并归档或删除。

### 3.5 为什么不直接给 `leads` 加字段

不建议在 `public.leads` 直接新增 shadow score 字段，原因：

- 避免 v0.2 shadow 结果被误认为正式生产评分；
- 避免污染 v0.1 trigger 管理的 `score`、`grade`、`priority`；
- shadow run 可能多版本、多批次、多配置，单列无法表达历史；
- 独立表更容易清理、归档、禁用和审计；
- 独立表便于保留 `config_version`、`engine_version`、`checksum` 与 replay metadata。

## 4. SQL 草案：禁止执行

以下仅为 SQL 草案，用于后续审查。不得直接执行，不得作为 migration 使用。

```sql
-- 禁止执行：Lead Scoring v0.2 Shadow Mode SQL 草案
-- 目的：仅设计独立 shadow 表，不写 public.leads 正式评分字段。

-- CREATE TABLE public.lead_scoring_shadow_runs (
--   shadow_run_id uuid PRIMARY KEY,
--   run_mode text NOT NULL,
--   trigger_source text NOT NULL,
--   requested_by text,
--   config_version text NOT NULL,
--   config_checksum text NOT NULL,
--   engine_version text NOT NULL,
--   outcome_policy_version text,
--   run_status text NOT NULL,
--   lead_count integer NOT NULL DEFAULT 0,
--   started_at timestamptz,
--   completed_at timestamptz,
--   error_summary text,
--   created_at timestamptz NOT NULL DEFAULT now()
-- );

-- CREATE TABLE public.lead_scoring_shadow_results (
--   shadow_result_id uuid PRIMARY KEY,
--   shadow_run_id uuid NOT NULL REFERENCES public.lead_scoring_shadow_runs(shadow_run_id),
--   lead_id uuid NOT NULL REFERENCES public.leads(id),
--   shadow_score numeric,
--   breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
--   applied_rule_count integer NOT NULL DEFAULT 0,
--   config_version text NOT NULL,
--   config_checksum text NOT NULL,
--   engine_version text NOT NULL,
--   replay_consistency boolean NOT NULL DEFAULT false,
--   inconsistency_type text,
--   input_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
--   created_at timestamptz NOT NULL DEFAULT now()
-- );

-- CREATE TABLE public.lead_scoring_shadow_diff (
--   shadow_diff_id uuid PRIMARY KEY,
--   shadow_result_id uuid NOT NULL REFERENCES public.lead_scoring_shadow_results(shadow_result_id),
--   lead_id uuid NOT NULL REFERENCES public.leads(id),
--   v01_score integer,
--   v01_grade text,
--   v01_priority text,
--   shadow_score numeric,
--   score_delta numeric,
--   grade_diff_status text,
--   priority_diff_status text,
--   requires_review boolean NOT NULL DEFAULT false,
--   diff_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
--   created_at timestamptz NOT NULL DEFAULT now()
-- );

-- CREATE TABLE public.lead_scoring_shadow_explanations (
--   shadow_explanation_id uuid PRIMARY KEY,
--   shadow_result_id uuid NOT NULL REFERENCES public.lead_scoring_shadow_results(shadow_result_id),
--   rule_id text NOT NULL,
--   rule_type text,
--   field text,
--   operator text,
--   dimension text,
--   raw_delta numeric,
--   weight numeric,
--   effective_delta numeric,
--   expected_value_summary text,
--   actual_value_summary text,
--   created_at timestamptz NOT NULL DEFAULT now()
-- );

-- CREATE INDEX idx_shadow_results_lead_id ON public.lead_scoring_shadow_results(lead_id);
-- CREATE INDEX idx_shadow_results_run_id ON public.lead_scoring_shadow_results(shadow_run_id);
-- CREATE INDEX idx_shadow_diff_requires_review ON public.lead_scoring_shadow_diff(requires_review);
-- CREATE INDEX idx_shadow_explanations_result_id ON public.lead_scoring_shadow_explanations(shadow_result_id);
```

## 5. n8n 接入草案：不导入、不发布、不激活

建议新建独立 inactive workflow，而不是修改现有 v0.1 workflow：

`Lead Scoring v0.2 Shadow - Single Lead Test`

建议节点：

1. Manual Trigger
2. Set Test Lead UUID
3. Fetch One Lead Readonly
4. Prepare Scoring Input Summary
5. Call Local Scoring Runtime / API Facade
6. Prepare Shadow Result
7. Insert Shadow Run
8. Insert Shadow Result
9. Insert Shadow Diff
10. Optional Insert Shadow Explanations
11. Fetch Shadow Review Summary
12. Show Result

接入位置：

- 不插入现有 v0.1 生产写入链路；
- 可在 `Lead Intake Form` 或 `Candidate Promotion` 完成正式写入后，作为旁路手动触发读取已存在 lead；
- 初期必须单条 Lead 手动触发；
- 后续小批量必须有明确 LIMIT、人工批准和失败跳过策略。

输入：

- `lead_id`
- `config_version`
- `run_mode = shadow`
- `request_trace_id`

输出：

- shadow score
- breakdown
- applied rule count
- replay consistency
- diff summary
- requires review

失败策略：

- shadow scoring 失败不得影响 v0.1；
- shadow insert 失败不得更新 `public.leads`；
- validation error 时写入 blocked shadow result 或仅在人工界面显示，不生成伪成功分数；
- workflow 默认 inactive。

## 6. Shadow run 验收标准

- 单条 Lead 可手动运行；
- v0.1 正式字段不变；
- v0.2 shadow result 可查询；
- shadow explanation 脱敏；
- `replay_consistency=true`；
- diff report 可读；
- n8n workflow 不改生产路径；
- shadow 可停用；
- shadow 数据可删除或归档且不影响 `public.leads`；
- invalid config 不生成伪成功评分；
- 不输出完整 email、phone、HTML、headers、cookies、stack、secrets。

## 7. 风险与回滚

风险：

- 数据库写入 shadow 表时误写正式字段；
- n8n 误接入生产路径；
- config version / checksum 与 engine version 不一致；
- shadow 结果被业务误认为正式结果；
- explanation 保存过多原始输入导致敏感数据泄露；
- 小批量 shadow run 误扩大为全量重评分。

回滚方式：

- 停用 shadow workflow；
- 停用 shadow writer；
- 删除或归档 shadow 表数据；
- 不动 `public.leads`；
- 不动 v0.1 trigger；
- 不动 v0.1 function；
- 不修改现有 n8n v0.1 workflow；
- 不触发客户外联。

## 8. 进入执行前需要用户批准

以下动作必须由用户明确批准：

- 连接只读 PostgreSQL 做实时 metadata 审查；
- 编写正式 migration SQL；
- 执行任何 SQL；
- 导入 n8n workflow；
- 激活或运行 n8n workflow；
- 小批量 shadow run；
- 修改 v0.1 trigger/function；
- Git 暂存、提交、推送。
