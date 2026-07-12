// @ts-check

const { createHash } = require("node:crypto");
const { normalizeLead } = require("../../ingestion/src/index.ts");
const { validateIntakePersistenceEnvelope } = require("../../persistence/src/production-persistence-contract.ts");
const { validateIdempotencyReplayEnvelope } = require("../../persistence/src/idempotency-replay-safety.ts");

const NORMALIZATION_VERSION = "phase1-normalization-v1";
const DEDUPLICATION_VERSION = "m1-wp02-not-evaluated-v1";

/** @param {string} prefix @param {string} value */
function stableId(prefix, value) {
  return `${prefix}-${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
}

/** @param {unknown} value */
function safeSourceUrl(value) {
  const raw = String(value || "").trim();
  if (!/^https?:\/\//i.test(raw)) return null;
  return raw.split("?")[0].split("#")[0] || null;
}

/** @param {Record<string, unknown>} input */
function sourcePayloadHash(input) {
  const safeMaterial = JSON.stringify({
    company_name: String(input.company_name || input.company || "").trim(),
    website: safeSourceUrl(input.website),
    country: String(input.country || "").trim().toUpperCase(),
    industry: String(input.industry || "").trim(),
  });
  return createHash("sha256").update(safeMaterial).digest("hex");
}

/**
 * @param {{
 *   repository: import("../../persistence/src/repositories.ts").IntakeRepository,
 *   tenant_id: string,
 *   organization_id?: string | null,
 *   actor_user_id?: string | null,
 *   request_trace_id: string,
 *   idempotency_key: string,
 *   trigger_source: import("../../persistence/src/types.ts").IntakeTriggerSource,
 *   source_url?: string,
 *   lead: Record<string, unknown>
 * }} input
 */
async function persistIntakeSubmission(input) {
  const envelope = {
    scope: {
      tenant_id: input.tenant_id,
      organization_id: input.organization_id || null,
      actor_user_id: input.actor_user_id || null,
      request_trace_id: input.request_trace_id,
      idempotency_key: input.idempotency_key,
    },
    version_anchors: {
      normalization_version: NORMALIZATION_VERSION,
      deduplication_version: DEDUPLICATION_VERSION,
      contract_version: "m1-wp01-draft",
    },
    trigger_source: input.trigger_source,
    source_summary: { source_url: safeSourceUrl(input.source_url) },
    candidate_summary: {
      has_company_name: Boolean(input.lead.company_name || input.lead.company),
      has_website: Boolean(input.lead.website),
      has_email: Boolean(input.lead.email),
      has_phone: Boolean(input.lead.phone),
    },
  };
  const validation = validateIntakePersistenceEnvelope(envelope);
  if (!validation.valid) throw new Error(`intake_contract_invalid:${validation.errors.join(",")}`);
  const idempotencyValidation = validateIdempotencyReplayEnvelope({
    tenant_id: input.tenant_id,
    request_trace_id: input.request_trace_id,
    idempotency_key: input.idempotency_key,
    operation: "intake_submission",
    replay_behavior: "reuse_existing",
  });
  if (!idempotencyValidation.valid) throw new Error(`idempotency_contract_invalid:${idempotencyValidation.errors.join(",")}`);

  const existing = await input.repository.getIntakeRunByIdempotencyKey(input.tenant_id, input.idempotency_key);
  if (existing) {
    return {
      reused: true,
      run: existing,
      source_item: null,
      candidate: null,
    };
  }

  const normalized = normalizeLead(input.lead);
  const now = new Date().toISOString();
  const runId = stableId("intake-run", `${input.tenant_id}:${input.idempotency_key}`);
  const sourceItemId = stableId("source-item", `${runId}:${sourcePayloadHash(input.lead)}`);
  const candidateId = stableId("intake-candidate", `${runId}:${normalized.id}`);

  const run = await input.repository.createIntakeRun({
    intake_run_id: runId,
    tenant_id: input.tenant_id,
    organization_id: input.organization_id || null,
    actor_user_id: input.actor_user_id || null,
    request_trace_id: input.request_trace_id,
    idempotency_key: input.idempotency_key,
    trigger_source: input.trigger_source,
    normalization_version: NORMALIZATION_VERSION,
    deduplication_version: DEDUPLICATION_VERSION,
    contract_version: "m1-wp01-draft",
    run_status: "running",
    source_item_count: 0,
    candidate_count: 0,
    error_code: null,
    created_at: now,
    completed_at: null,
  });
  const sourceItem = await input.repository.createSourceItem({
    source_item_id: sourceItemId,
    intake_run_id: run.intake_run_id,
    source_type: input.trigger_source,
    source_url: safeSourceUrl(input.source_url),
    payload_hash: sourcePayloadHash(input.lead),
    source_summary: {
      has_company_name: Boolean(input.lead.company_name || input.lead.company),
      has_website: Boolean(input.lead.website),
      has_email: Boolean(input.lead.email),
      has_phone: Boolean(input.lead.phone),
    },
    captured_at: now,
  });
  const candidate = await input.repository.createCandidate({
    candidate_id: candidateId,
    intake_run_id: run.intake_run_id,
    source_item_id: sourceItem.source_item_id,
    company_name: normalized.company_name,
    domain: normalized.domain,
    country: normalized.country,
    industry: normalized.industry,
    has_email: Boolean(normalized.email),
    has_phone: Boolean(normalized.phone),
    signals: normalized.signals,
    candidate_status: "pending_review",
    dedup_status: "not_evaluated",
    normalization_version: NORMALIZATION_VERSION,
    normalization_summary: {
      domain: normalized.domain,
      country: normalized.country,
      industry: normalized.industry,
      signals_count: normalized.signals.length,
    },
    created_at: now,
  });
  const completedRun = await input.repository.completeIntakeRun(run.intake_run_id, {
    run_status: "completed",
    source_item_count: 1,
    candidate_count: 1,
    completed_at: now,
  });

  return { reused: false, run: completedRun, source_item: sourceItem, candidate };
}

module.exports = {
  NORMALIZATION_VERSION,
  DEDUPLICATION_VERSION,
  persistIntakeSubmission,
  safeSourceUrl,
};
