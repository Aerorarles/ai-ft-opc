-- DRAFT ONLY - DO NOT EXECUTE
-- NOT APPROVED FOR PRODUCTION
-- MUST NOT MODIFY public.leads OFFICIAL SCORE FIELDS
-- 本文件仅为 Lead Scoring v0.2 Shadow Mode 独立表结构草案。
-- 未经用户明确批准，不得执行、不得改写为正式 migration、不得连接数据库。
-- 安全边界：
-- 1. 不修改 public.leads。
-- 2. 不写 leads.score / grade / priority / lead_score_breakdown / last_scored_at。
-- 3. 不修改 score_lead_v01()。
-- 4. 不修改 leads_score_v01 trigger。
-- 5. 不保存完整 email、phone、raw_data、HTML、headers、cookies、stack、response、credentials 或 secrets。

BEGIN;

-- 记录一次 v0.2 shadow scoring 运行上下文。
CREATE TABLE IF NOT EXISTS public.lead_scoring_shadow_runs (
  shadow_run_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_mode text NOT NULL DEFAULT 'shadow',
  trigger_source text NOT NULL DEFAULT 'manual',
  request_trace_id text,
  config_version text NOT NULL,
  config_checksum text NOT NULL,
  engine_version text NOT NULL,
  outcome_policy_version text,
  outcome_policy_checksum text,
  run_status text NOT NULL DEFAULT 'queued',
  lead_count integer NOT NULL DEFAULT 0,
  error_code text,
  error_summary text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_scoring_shadow_runs_mode_check
    CHECK (run_mode IN ('shadow', 'preview')),
  CONSTRAINT lead_scoring_shadow_runs_trigger_source_check
    CHECK (trigger_source IN ('manual', 'n8n', 'api', 'shadow')),
  CONSTRAINT lead_scoring_shadow_runs_status_check
    CHECK (run_status IN ('queued', 'running', 'succeeded', 'partial', 'failed', 'blocked')),
  CONSTRAINT lead_scoring_shadow_runs_lead_count_check
    CHECK (lead_count >= 0)
);

COMMENT ON TABLE public.lead_scoring_shadow_runs IS
  'DRAFT: v0.2 shadow scoring run metadata only. Does not modify public.leads.';
COMMENT ON COLUMN public.lead_scoring_shadow_runs.config_checksum IS
  'Required for replay and diff reproducibility.';
COMMENT ON COLUMN public.lead_scoring_shadow_runs.error_summary IS
  'Sanitized summary only. Do not store stack, response, headers, cookies, credentials, or secrets.';

-- 保存单个 Lead 的 v0.2 shadow 评分结果。
CREATE TABLE IF NOT EXISTS public.lead_scoring_shadow_results (
  shadow_result_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shadow_run_id uuid NOT NULL REFERENCES public.lead_scoring_shadow_runs(shadow_run_id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  shadow_score numeric,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_rule_count integer NOT NULL DEFAULT 0,
  config_version text NOT NULL,
  config_checksum text NOT NULL,
  engine_version text NOT NULL,
  replay_consistency boolean NOT NULL DEFAULT false,
  inconsistency_type text NOT NULL DEFAULT 'NONE',
  input_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_status text NOT NULL DEFAULT 'not_checked',
  validation_errors_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_scoring_shadow_results_rule_count_check
    CHECK (applied_rule_count >= 0),
  CONSTRAINT lead_scoring_shadow_results_validation_status_check
    CHECK (validation_status IN ('valid', 'invalid', 'not_checked')),
  CONSTRAINT lead_scoring_shadow_results_inconsistency_type_check
    CHECK (
      inconsistency_type IN (
        'NONE',
        'MISSING_EVENTS',
        'CHECKSUM_MISMATCH',
        'ENGINE_VERSION_MISMATCH',
        'CONFIG_MISMATCH',
        'RERUN_DIFFERENCE',
        'ORDER_CORRUPTION'
      )
    ),
  CONSTRAINT lead_scoring_shadow_results_run_lead_unique
    UNIQUE (shadow_run_id, lead_id)
);

COMMENT ON TABLE public.lead_scoring_shadow_results IS
  'DRAFT: v0.2 shadow scoring result. Never treated as production score.';
COMMENT ON COLUMN public.lead_scoring_shadow_results.input_summary IS
  'Sanitized structured summary only. Do not store full email, full phone, raw_data, HTML, headers, cookies, stack, response, credentials, or secrets.';
COMMENT ON COLUMN public.lead_scoring_shadow_results.breakdown IS
  'Score dimension summary only.';

-- 保存 v0.1 正式评分与 v0.2 shadow 分数的差异。
CREATE TABLE IF NOT EXISTS public.lead_scoring_shadow_diff (
  shadow_diff_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shadow_result_id uuid NOT NULL REFERENCES public.lead_scoring_shadow_results(shadow_result_id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  v01_score integer,
  v01_grade text,
  v01_priority text,
  shadow_score numeric,
  score_delta numeric,
  grade_diff_status text NOT NULL DEFAULT 'not_evaluated',
  priority_diff_status text NOT NULL DEFAULT 'not_evaluated',
  requires_review boolean NOT NULL DEFAULT false,
  diff_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_scoring_shadow_diff_grade_status_check
    CHECK (grade_diff_status IN ('same', 'different', 'not_evaluated')),
  CONSTRAINT lead_scoring_shadow_diff_priority_status_check
    CHECK (priority_diff_status IN ('same', 'different', 'not_evaluated')),
  CONSTRAINT lead_scoring_shadow_diff_result_unique
    UNIQUE (shadow_result_id)
);

COMMENT ON TABLE public.lead_scoring_shadow_diff IS
  'DRAFT: comparison between v0.1 production score and v0.2 shadow score.';
COMMENT ON COLUMN public.lead_scoring_shadow_diff.diff_summary IS
  'Sanitized diff summary only. Do not store raw lead data or sensitive fields.';

-- 可选：保存命中规则的脱敏解释摘要。
CREATE TABLE IF NOT EXISTS public.lead_scoring_shadow_explanations (
  shadow_explanation_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shadow_result_id uuid NOT NULL REFERENCES public.lead_scoring_shadow_results(shadow_result_id) ON DELETE CASCADE,
  rule_id text NOT NULL,
  rule_type text,
  field text,
  operator text,
  dimension text,
  raw_delta numeric,
  weight numeric,
  effective_delta numeric,
  expected_value_summary text,
  actual_value_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lead_scoring_shadow_explanations IS
  'DRAFT: sanitized rule-hit explanation summaries for v0.2 shadow scoring.';
COMMENT ON COLUMN public.lead_scoring_shadow_explanations.actual_value_summary IS
  'Sanitized summary only. Do not store full email, full phone, HTML, headers, cookies, stack, response, credentials, or secrets.';

CREATE INDEX IF NOT EXISTS idx_shadow_runs_status_created
  ON public.lead_scoring_shadow_runs (run_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shadow_results_lead_id
  ON public.lead_scoring_shadow_results (lead_id);

CREATE INDEX IF NOT EXISTS idx_shadow_results_run_id
  ON public.lead_scoring_shadow_results (shadow_run_id);

CREATE INDEX IF NOT EXISTS idx_shadow_results_config
  ON public.lead_scoring_shadow_results (config_version, engine_version);

CREATE INDEX IF NOT EXISTS idx_shadow_diff_lead_id
  ON public.lead_scoring_shadow_diff (lead_id);

CREATE INDEX IF NOT EXISTS idx_shadow_diff_requires_review
  ON public.lead_scoring_shadow_diff (requires_review, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shadow_explanations_result_id
  ON public.lead_scoring_shadow_explanations (shadow_result_id);

COMMIT;

-- 回滚说明（仅文字说明，不是可执行 SQL）：
-- 若本草案未来被用户批准并实施，回滚必须单独提交新的回滚 SQL 草案并再次审查。
-- 回滚原则是先确认不需要保留 shadow 审计历史，再按依赖关系逆序移除 explanations、diff、results、runs。
-- 回滚草案必须明确影响范围、备份方式、停机/锁表风险和验收标准，不得在本 DRAFT 中直接提供 DROP SQL。
