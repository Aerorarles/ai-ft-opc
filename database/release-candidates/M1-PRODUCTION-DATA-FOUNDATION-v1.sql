-- RELEASE CANDIDATE ONLY - NOT APPROVED FOR EXECUTION
-- M1 Production Data Foundation v1
-- Preconditions: approved execution role, verified uuid-ossp extension, backup confirmation,
-- approved maintenance window, and feature writers disabled.
-- This candidate must not modify public.leads official scoring fields or the v0.1 trigger/function.
-- Persisted summaries must never include full email, full phone, raw_data, HTML, headers,
-- cookies, stack traces, raw responses, credentials, secrets, or original request payloads.

BEGIN;

CREATE TABLE public.lead_scoring_shadow_runs (
  shadow_run_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id text NOT NULL,
  organization_id text,
  actor_user_id text,
  execution_id text NOT NULL,
  request_trace_id text NOT NULL,
  idempotency_key text NOT NULL,
  run_mode text NOT NULL DEFAULT 'shadow',
  trigger_source text NOT NULL DEFAULT 'manual',
  config_version text NOT NULL,
  config_checksum text NOT NULL,
  engine_version text NOT NULL,
  outcome_policy_id text,
  outcome_policy_version text,
  outcome_policy_checksum text,
  run_status text NOT NULL DEFAULT 'queued',
  lead_count integer NOT NULL DEFAULT 0,
  error_code text,
  error_summary text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_scoring_shadow_runs_tenant_key UNIQUE (shadow_run_id, tenant_id),
  CONSTRAINT lead_scoring_shadow_runs_tenant_idempotency_unique UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT lead_scoring_shadow_runs_mode_check CHECK (run_mode IN ('shadow', 'preview')),
  CONSTRAINT lead_scoring_shadow_runs_trigger_source_check CHECK (trigger_source IN ('manual', 'n8n', 'api', 'shadow')),
  CONSTRAINT lead_scoring_shadow_runs_status_check CHECK (run_status IN ('queued', 'running', 'succeeded', 'partial', 'failed', 'blocked')),
  CONSTRAINT lead_scoring_shadow_runs_lead_count_check CHECK (lead_count >= 0)
);

CREATE TABLE public.lead_scoring_shadow_results (
  shadow_result_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id text NOT NULL,
  shadow_run_id uuid NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  execution_id text NOT NULL,
  organization_id text,
  actor_user_id text,
  shadow_score numeric,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_rule_count integer NOT NULL DEFAULT 0,
  config_version text NOT NULL,
  config_checksum text NOT NULL,
  engine_version text NOT NULL,
  outcome_policy_id text,
  outcome_policy_version text,
  outcome_policy_checksum text,
  replay_consistency boolean NOT NULL DEFAULT false,
  inconsistency_type text NOT NULL DEFAULT 'NONE',
  input_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_status text NOT NULL DEFAULT 'not_checked',
  validation_errors_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_scoring_shadow_results_tenant_key UNIQUE (shadow_result_id, tenant_id),
  CONSTRAINT lead_scoring_shadow_results_result_run_tenant_unique UNIQUE (shadow_result_id, shadow_run_id, tenant_id),
  CONSTRAINT lead_scoring_shadow_results_run_lead_unique UNIQUE (tenant_id, shadow_run_id, lead_id),
  CONSTRAINT lead_scoring_shadow_results_run_tenant_fkey
    FOREIGN KEY (shadow_run_id, tenant_id)
    REFERENCES public.lead_scoring_shadow_runs (shadow_run_id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT lead_scoring_shadow_results_rule_count_check CHECK (applied_rule_count >= 0),
  CONSTRAINT lead_scoring_shadow_results_validation_status_check CHECK (validation_status IN ('valid', 'invalid', 'not_checked')),
  CONSTRAINT lead_scoring_shadow_results_inconsistency_type_check CHECK (
    inconsistency_type IN ('NONE', 'MISSING_EVENTS', 'CHECKSUM_MISMATCH', 'ENGINE_VERSION_MISMATCH', 'CONFIG_MISMATCH', 'RERUN_DIFFERENCE', 'ORDER_CORRUPTION')
  )
);

CREATE TABLE public.lead_scoring_shadow_diff (
  shadow_diff_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id text NOT NULL,
  shadow_result_id uuid NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  organization_id text,
  actor_user_id text,
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
  CONSTRAINT lead_scoring_shadow_diff_tenant_key UNIQUE (shadow_diff_id, tenant_id),
  CONSTRAINT lead_scoring_shadow_diff_result_unique UNIQUE (tenant_id, shadow_result_id),
  CONSTRAINT lead_scoring_shadow_diff_result_tenant_fkey
    FOREIGN KEY (shadow_result_id, tenant_id)
    REFERENCES public.lead_scoring_shadow_results (shadow_result_id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT lead_scoring_shadow_diff_grade_status_check CHECK (grade_diff_status IN ('same', 'different', 'not_evaluated')),
  CONSTRAINT lead_scoring_shadow_diff_priority_status_check CHECK (priority_diff_status IN ('same', 'different', 'not_evaluated'))
);

CREATE TABLE public.lead_scoring_shadow_explanations (
  shadow_explanation_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id text NOT NULL,
  shadow_result_id uuid NOT NULL,
  organization_id text,
  actor_user_id text,
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
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_scoring_shadow_explanations_tenant_key UNIQUE (shadow_explanation_id, tenant_id),
  CONSTRAINT lead_scoring_shadow_explanations_result_tenant_fkey
    FOREIGN KEY (shadow_result_id, tenant_id)
    REFERENCES public.lead_scoring_shadow_results (shadow_result_id, tenant_id) ON DELETE RESTRICT
);

CREATE TABLE public.lead_review_queue (
  review_item_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id text NOT NULL,
  organization_id text,
  actor_user_id text,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  shadow_run_id uuid,
  shadow_result_id uuid,
  request_trace_id text NOT NULL,
  idempotency_key text NOT NULL,
  review_status text NOT NULL DEFAULT 'pending',
  action_recommendation text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_step text NOT NULL,
  assigned_to text,
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_review_queue_tenant_key UNIQUE (review_item_id, tenant_id),
  CONSTRAINT lead_review_queue_tenant_idempotency_unique UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT lead_review_queue_shadow_run_tenant_fkey
    FOREIGN KEY (shadow_run_id, tenant_id)
    REFERENCES public.lead_scoring_shadow_runs (shadow_run_id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT lead_review_queue_shadow_result_run_tenant_fkey
    FOREIGN KEY (shadow_result_id, shadow_run_id, tenant_id)
    REFERENCES public.lead_scoring_shadow_results (shadow_result_id, shadow_run_id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT lead_review_queue_shadow_link_check CHECK (
    (shadow_run_id IS NULL AND shadow_result_id IS NULL)
    OR (shadow_run_id IS NOT NULL AND shadow_result_id IS NOT NULL)
  ),
  CONSTRAINT lead_review_queue_status_check CHECK (review_status IN ('pending', 'approved', 'rejected', 'skipped')),
  CONSTRAINT lead_review_queue_action_check CHECK (action_recommendation IN ('HOT', 'WARM', 'COLD')),
  CONSTRAINT lead_review_queue_confidence_check CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE TABLE public.lead_review_decisions (
  review_decision_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id text NOT NULL,
  organization_id text,
  actor_user_id text,
  review_item_id uuid NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  request_trace_id text NOT NULL,
  idempotency_key text NOT NULL,
  decision text NOT NULL,
  decision_notes_summary text,
  decided_by text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_review_decisions_tenant_key UNIQUE (review_decision_id, tenant_id),
  CONSTRAINT lead_review_decisions_tenant_idempotency_unique UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT lead_review_decisions_item_tenant_fkey
    FOREIGN KEY (review_item_id, tenant_id)
    REFERENCES public.lead_review_queue (review_item_id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT lead_review_decisions_decision_check CHECK (decision IN ('approved', 'rejected', 'skipped'))
);

CREATE TABLE public.lead_intake_runs (
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
  CONSTRAINT lead_intake_runs_tenant_key UNIQUE (intake_run_id, tenant_id),
  CONSTRAINT lead_intake_runs_tenant_idempotency_unique UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT lead_intake_runs_trigger_source_check CHECK (trigger_source IN ('manual', 'api', 'n8n', 'import')),
  CONSTRAINT lead_intake_runs_status_check CHECK (run_status IN ('queued', 'running', 'completed', 'failed', 'blocked')),
  CONSTRAINT lead_intake_runs_counts_check CHECK (source_item_count >= 0 AND candidate_count >= 0)
);

CREATE TABLE public.lead_intake_source_items (
  source_item_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id text NOT NULL,
  intake_run_id uuid NOT NULL,
  organization_id text,
  actor_user_id text,
  source_type text NOT NULL,
  source_url text,
  payload_hash text NOT NULL,
  source_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_intake_source_items_tenant_key UNIQUE (source_item_id, tenant_id),
  CONSTRAINT lead_intake_source_items_run_tenant_fkey
    FOREIGN KEY (intake_run_id, tenant_id)
    REFERENCES public.lead_intake_runs (intake_run_id, tenant_id) ON DELETE RESTRICT
);

CREATE TABLE public.lead_intake_candidates (
  intake_candidate_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id text NOT NULL,
  intake_run_id uuid NOT NULL,
  source_item_id uuid NOT NULL,
  organization_id text,
  actor_user_id text,
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
  CONSTRAINT lead_intake_candidates_tenant_key UNIQUE (intake_candidate_id, tenant_id),
  CONSTRAINT lead_intake_candidates_run_tenant_fkey
    FOREIGN KEY (intake_run_id, tenant_id)
    REFERENCES public.lead_intake_runs (intake_run_id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT lead_intake_candidates_source_tenant_fkey
    FOREIGN KEY (source_item_id, tenant_id)
    REFERENCES public.lead_intake_source_items (source_item_id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT lead_intake_candidates_status_check CHECK (candidate_status = 'pending_review'),
  CONSTRAINT lead_intake_candidates_dedup_check CHECK (dedup_status = 'not_evaluated')
);

CREATE TABLE public.lead_operation_idempotency_claims (
  idempotency_claim_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id text NOT NULL,
  organization_id text,
  actor_user_id text,
  operation_type text NOT NULL,
  idempotency_key text NOT NULL,
  request_trace_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  request_fingerprint text,
  claim_status text NOT NULL DEFAULT 'reserved',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT lead_operation_idempotency_claims_tenant_key UNIQUE (idempotency_claim_id, tenant_id),
  CONSTRAINT lead_operation_idempotency_unique UNIQUE (tenant_id, operation_type, idempotency_key),
  CONSTRAINT lead_operation_idempotency_type_check CHECK (operation_type IN ('intake_submission', 'shadow_run', 'review_action', 'audit_event')),
  CONSTRAINT lead_operation_idempotency_status_check CHECK (claim_status IN ('reserved', 'completed', 'failed', 'reused'))
);

CREATE TABLE public.lead_audit_events (
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
  CONSTRAINT lead_audit_events_tenant_key UNIQUE (audit_event_id, tenant_id),
  CONSTRAINT lead_audit_events_trace_sequence_unique UNIQUE (tenant_id, request_trace_id, sequence_index),
  CONSTRAINT lead_audit_events_tenant_idempotency_unique UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT lead_audit_events_type_check CHECK (event_type IN ('intake_completed', 'shadow_persisted', 'review_decided')),
  CONSTRAINT lead_audit_events_sequence_check CHECK (sequence_index >= 0)
);

CREATE INDEX idx_shadow_runs_tenant_status_created
  ON public.lead_scoring_shadow_runs (tenant_id, run_status, created_at DESC);
CREATE INDEX idx_shadow_runs_tenant_trace
  ON public.lead_scoring_shadow_runs (tenant_id, request_trace_id, created_at DESC);
CREATE INDEX idx_shadow_results_tenant_lead
  ON public.lead_scoring_shadow_results (tenant_id, lead_id, created_at DESC);
CREATE INDEX idx_shadow_results_tenant_config
  ON public.lead_scoring_shadow_results (tenant_id, config_version, engine_version);
CREATE INDEX idx_shadow_diff_tenant_review
  ON public.lead_scoring_shadow_diff (tenant_id, requires_review, created_at DESC);
CREATE INDEX idx_shadow_explanations_tenant_result
  ON public.lead_scoring_shadow_explanations (tenant_id, shadow_result_id);
CREATE INDEX idx_lead_review_queue_tenant_status_created
  ON public.lead_review_queue (tenant_id, review_status, created_at DESC);
CREATE INDEX idx_lead_review_queue_tenant_lead
  ON public.lead_review_queue (tenant_id, lead_id);
CREATE INDEX idx_lead_review_queue_tenant_shadow_result
  ON public.lead_review_queue (tenant_id, shadow_result_id);
CREATE INDEX idx_lead_review_decisions_tenant_item
  ON public.lead_review_decisions (tenant_id, review_item_id, decided_at DESC);
CREATE INDEX idx_lead_intake_runs_tenant_trace
  ON public.lead_intake_runs (tenant_id, request_trace_id, created_at DESC);
CREATE INDEX idx_lead_intake_source_items_tenant_run
  ON public.lead_intake_source_items (tenant_id, intake_run_id);
CREATE INDEX idx_lead_intake_candidates_tenant_run
  ON public.lead_intake_candidates (tenant_id, intake_run_id, created_at DESC);
CREATE INDEX idx_lead_operation_idempotency_tenant_trace
  ON public.lead_operation_idempotency_claims (tenant_id, request_trace_id, created_at DESC);
CREATE INDEX idx_lead_audit_events_tenant_trace
  ON public.lead_audit_events (tenant_id, request_trace_id, sequence_index);
CREATE INDEX idx_lead_audit_events_tenant_entity
  ON public.lead_audit_events (tenant_id, entity_type, entity_id, occurred_at DESC);

COMMENT ON TABLE public.lead_scoring_shadow_runs IS
  'M1 release candidate: v0.2 shadow metadata. Never modifies official v0.1 lead scores.';
COMMENT ON COLUMN public.lead_scoring_shadow_results.input_summary IS
  'Sanitized structured summary only; application validation rejects sensitive or raw runtime content.';
COMMENT ON COLUMN public.lead_scoring_shadow_explanations.actual_value_summary IS
  'Sanitized explanation only; no full contact values or runtime response content.';
COMMENT ON COLUMN public.lead_review_queue.review_notes_summary IS
  'Sanitized human review summary only.';
COMMENT ON COLUMN public.lead_intake_source_items.source_summary IS
  'Sanitized source summary only; source URL must be normalized by the application.';
COMMENT ON COLUMN public.lead_audit_events.payload_summary IS
  'Append-only sanitized audit summary. Replay reads recorded events and never reruns business work.';

COMMIT;
