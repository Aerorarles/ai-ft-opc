-- DRAFT ONLY - DO NOT EXECUTE
-- NOT APPROVED FOR PRODUCTION
-- MUST NOT MODIFY public.leads OFFICIAL SCORE FIELDS
-- 本文件仅为 Phase 2 Human Review Queue 独立表结构草案。
-- 未经用户明确批准，不得执行、不得改写为正式 migration、不得连接数据库。
-- 安全边界：
-- 1. 不修改 public.leads。
-- 2. 不写 leads.score / grade / priority / lead_score_breakdown / last_scored_at。
-- 3. 不修改 score_lead_v01()。
-- 4. 不修改 leads_score_v01 trigger。
-- 5. 不保存完整 email、phone、raw_data、HTML、headers、cookies、stack、response、credentials 或 secrets。

BEGIN;

-- 人工审核队列，仅承载 shadow 评分后的人工复核任务。
CREATE TABLE IF NOT EXISTS public.lead_review_queue (
  review_item_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  shadow_run_id uuid,
  shadow_result_id uuid,
  review_status text NOT NULL DEFAULT 'pending',
  action_recommendation text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_step text NOT NULL,
  assigned_to text,
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_review_queue_status_check
    CHECK (review_status IN ('pending', 'approved', 'rejected', 'skipped')),
  CONSTRAINT lead_review_queue_action_check
    CHECK (action_recommendation IN ('HOT', 'WARM', 'COLD')),
  CONSTRAINT lead_review_queue_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1)
);

COMMENT ON TABLE public.lead_review_queue IS
  'DRAFT: Phase 2 human review queue. Does not modify public.leads official score fields.';
COMMENT ON COLUMN public.lead_review_queue.reasons IS
  'Sanitized decision reasons only. Do not store raw lead data or secrets.';
COMMENT ON COLUMN public.lead_review_queue.risk_flags IS
  'Sanitized risk flags only. No HTML, headers, cookies, stack, response, credentials, or secrets.';

-- 可选：记录审核动作历史，便于后续审计。
CREATE TABLE IF NOT EXISTS public.lead_review_decisions (
  review_decision_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_item_id uuid NOT NULL REFERENCES public.lead_review_queue(review_item_id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  decision text NOT NULL,
  decision_notes text,
  decided_by text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_review_decisions_decision_check
    CHECK (decision IN ('approved', 'rejected', 'skipped'))
);

COMMENT ON TABLE public.lead_review_decisions IS
  'DRAFT: append-only review decision audit trail for Phase 2 local productization design.';
COMMENT ON COLUMN public.lead_review_decisions.decision_notes IS
  'Sanitized human review notes only. Do not store credentials, secrets, raw HTML, headers, cookies, or response bodies.';

CREATE INDEX IF NOT EXISTS idx_lead_review_queue_status_created
  ON public.lead_review_queue (review_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_review_queue_lead_id
  ON public.lead_review_queue (lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_review_queue_shadow_run
  ON public.lead_review_queue (shadow_run_id);

CREATE INDEX IF NOT EXISTS idx_lead_review_decisions_item_id
  ON public.lead_review_decisions (review_item_id);

CREATE INDEX IF NOT EXISTS idx_lead_review_decisions_lead_id
  ON public.lead_review_decisions (lead_id);

COMMIT;

-- 回滚说明（仅文字说明，不是可执行 SQL）：
-- 若本草案未来被用户批准并实施，回滚必须单独提交新的回滚 SQL 草案并再次审查。
-- 回滚原则是先确认是否需要保留人工审核审计历史，再按依赖关系逆序处理 decisions 与 queue。
-- 回滚草案必须明确影响范围、备份方式、审计留存要求和验收标准，不得在本 DRAFT 中直接提供 DROP SQL。
