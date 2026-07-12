-- 仅供审查的 SQL 草案：不得执行，未经用户书面批准不得转为正式 migration。
-- 适用范围：M1-WP02 Intake、M1-WP05 Audit、M1-WP06 Idempotency/Replay Safety。
-- 本草案不修改 public.leads，不写入 v0.1 score、grade、priority，不修改评分函数或 trigger。
-- 本草案不保存完整 email、phone、raw_data、HTML、headers、cookies、stack、response、credentials、secrets 或人工备注原文。
-- 执行前必须完成：数据库版本/扩展预检、现有表冲突审查、锁表影响评估、备份与回滚窗口确认。

BEGIN;

-- 受控 Intake 运行元数据，只保存来源与候选的脱敏摘要。
CREATE TABLE IF NOT EXISTS public.lead_intake_runs (
  intake_run_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id text NOT NULL,
  organization_id text,
  actor_user_id text,
  request_trace_id text NOT NULL,
  idempotency_key text NOT NULL,
  trigger_source text NOT NULL,
  normalization_version text NOT NULL,
  deduplication_version text NOT NULL,
  contract_version text NOT NULL,
  run_status text NOT NULL DEFAULT 'queued',
  source_item_count integer NOT NULL DEFAULT 0,
  candidate_count integer NOT NULL DEFAULT 0,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT lead_intake_runs_trigger_source_check
    CHECK (trigger_source IN ('manual', 'api', 'n8n', 'import')),
  CONSTRAINT lead_intake_runs_status_check
    CHECK (run_status IN ('queued', 'running', 'completed', 'failed', 'blocked')),
  CONSTRAINT lead_intake_runs_counts_check
    CHECK (source_item_count >= 0 AND candidate_count >= 0),
  CONSTRAINT lead_intake_runs_tenant_idempotency_unique
    UNIQUE (tenant_id, idempotency_key)
);

-- 来源项不保存原始请求体，仅保存去除 query/fragment 的 URL 和不可逆 hash。
CREATE TABLE IF NOT EXISTS public.lead_intake_source_items (
  source_item_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  intake_run_id uuid NOT NULL REFERENCES public.lead_intake_runs(intake_run_id) ON DELETE RESTRICT,
  source_type text NOT NULL,
  source_url text,
  payload_hash text NOT NULL,
  source_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);

-- 标准化候选只用于 pending_review，不创建正式 Lead，也不绕过人工审核。
CREATE TABLE IF NOT EXISTS public.lead_intake_candidates (
  intake_candidate_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  intake_run_id uuid NOT NULL REFERENCES public.lead_intake_runs(intake_run_id) ON DELETE RESTRICT,
  source_item_id uuid NOT NULL REFERENCES public.lead_intake_source_items(source_item_id) ON DELETE RESTRICT,
  company_name text NOT NULL,
  domain text,
  country text,
  industry text,
  has_email boolean NOT NULL DEFAULT false,
  has_phone boolean NOT NULL DEFAULT false,
  signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  candidate_status text NOT NULL DEFAULT 'pending_review',
  dedup_status text NOT NULL DEFAULT 'not_evaluated',
  normalization_version text NOT NULL,
  normalization_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_intake_candidates_status_check
    CHECK (candidate_status = 'pending_review'),
  CONSTRAINT lead_intake_candidates_dedup_check
    CHECK (dedup_status = 'not_evaluated')
);

-- 统一操作幂等声明。生产 adapter 必须在同一事务中先声明，再写入对应实体。
CREATE TABLE IF NOT EXISTS public.lead_operation_idempotency_claims (
  idempotency_claim_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id text NOT NULL,
  operation_type text NOT NULL,
  idempotency_key text NOT NULL,
  request_trace_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  request_fingerprint text,
  claim_status text NOT NULL DEFAULT 'reserved',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT lead_operation_idempotency_type_check
    CHECK (operation_type IN ('intake_submission', 'shadow_run', 'review_action', 'audit_event')),
  CONSTRAINT lead_operation_idempotency_status_check
    CHECK (claim_status IN ('reserved', 'completed', 'failed', 'reused')),
  CONSTRAINT lead_operation_idempotency_unique
    UNIQUE (tenant_id, operation_type, idempotency_key)
);

-- 跨 Intake、Shadow、Review 的最小审计事件；payload 只能是已脱敏摘要。
CREATE TABLE IF NOT EXISTS public.lead_audit_events (
  audit_event_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id text NOT NULL,
  organization_id text,
  actor_user_id text,
  request_trace_id text NOT NULL,
  idempotency_key text NOT NULL,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  intake_run_id uuid,
  shadow_run_id uuid,
  shadow_result_id uuid,
  review_item_id uuid,
  review_decision_id uuid,
  payload_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  sequence_index integer NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_audit_events_type_check
    CHECK (event_type IN ('intake_completed', 'shadow_persisted', 'review_decided')),
  CONSTRAINT lead_audit_events_sequence_check
    CHECK (sequence_index >= 0),
  CONSTRAINT lead_audit_events_trace_sequence_unique
    UNIQUE (tenant_id, request_trace_id, sequence_index),
  CONSTRAINT lead_audit_events_tenant_idempotency_unique
    UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_lead_intake_runs_trace
  ON public.lead_intake_runs (tenant_id, request_trace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_intake_source_items_run
  ON public.lead_intake_source_items (intake_run_id);

CREATE INDEX IF NOT EXISTS idx_lead_intake_candidates_run
  ON public.lead_intake_candidates (intake_run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_operation_idempotency_trace
  ON public.lead_operation_idempotency_claims (tenant_id, request_trace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_audit_events_trace
  ON public.lead_audit_events (tenant_id, request_trace_id, sequence_index);

CREATE INDEX IF NOT EXISTS idx_lead_audit_events_entity
  ON public.lead_audit_events (entity_type, entity_id, occurred_at DESC);

COMMENT ON TABLE public.lead_operation_idempotency_claims IS
  'DRAFT ONLY: transaction-scoped idempotency claims for M1 local contracts.';
COMMENT ON TABLE public.lead_audit_events IS
  'DRAFT ONLY: sanitized append-only audit events. Replay reads events and never re-runs business work.';
COMMENT ON COLUMN public.lead_audit_events.payload_summary IS
  'Sanitized summary only. Application validation must reject sensitive or raw fields before insert.';

COMMIT;

-- 回滚说明：本草案不包含可执行的回滚 DDL。任何未来回滚必须先确认审计保留、外键依赖、备份和审批，另行提交并审查。
