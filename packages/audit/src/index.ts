// @ts-check

const { createHash } = require("node:crypto");
const { validateAuditPersistenceEnvelope } = require("../../persistence/src/production-persistence-contract.ts");
const { validateIdempotencyReplayEnvelope } = require("../../persistence/src/idempotency-replay-safety.ts");

/** @param {string} prefix @param {unknown} value */
function stableId(prefix, value) {
  return `${prefix}-${createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24)}`;
}

/**
 * Append a minimum, sanitized audit event. The caller supplies only summary
 * fields; this module never reads raw lead payloads or replays business work.
 *
 * @param {{
 *   repository: import("../../persistence/src/repositories.ts").AuditRepository,
 *   tenant_id: string,
 *   organization_id?: string | null,
 *   actor_user_id?: string | null,
 *   request_trace_id: string,
 *   idempotency_key: string,
 *   event_type: "intake_completed" | "shadow_persisted" | "review_decided",
 *   entity_type: string,
 *   entity_id: string,
 *   intake_run_id?: string | null,
 *   shadow_run_id?: string | null,
 *   shadow_result_id?: string | null,
 *   review_item_id?: string | null,
 *   review_decision_id?: string | null,
 *   payload_summary?: Record<string, unknown>
 * }} input
 */
async function appendAuditEvent(input) {
  const idempotencyValidation = validateIdempotencyReplayEnvelope({
    tenant_id: input.tenant_id,
    request_trace_id: input.request_trace_id,
    idempotency_key: input.idempotency_key,
    operation: "audit_event",
    replay_behavior: "audit_only",
  });
  if (!idempotencyValidation.valid) throw new Error(`idempotency_contract_invalid:${idempotencyValidation.errors.join(",")}`);
  const envelope = {
    scope: {
      tenant_id: input.tenant_id,
      organization_id: input.organization_id || null,
      actor_user_id: input.actor_user_id || null,
      request_trace_id: input.request_trace_id,
      idempotency_key: input.idempotency_key,
    },
    event_type: input.event_type,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    payload_summary: input.payload_summary || {},
  };
  const validation = validateAuditPersistenceEnvelope(envelope);
  if (!validation.valid) throw new Error(`audit_contract_invalid:${validation.errors.join(",")}`);
  const existing = await input.repository.getAuditEventsByTrace(input.request_trace_id);
  const event = {
    audit_event_id: stableId("audit", { tenant: input.tenant_id, idempotency: input.idempotency_key }),
    tenant_id: input.tenant_id,
    organization_id: input.organization_id || null,
    actor_user_id: input.actor_user_id || null,
    request_trace_id: input.request_trace_id,
    idempotency_key: input.idempotency_key,
    event_type: input.event_type,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    intake_run_id: input.intake_run_id || null,
    shadow_run_id: input.shadow_run_id || null,
    shadow_result_id: input.shadow_result_id || null,
    review_item_id: input.review_item_id || null,
    review_decision_id: input.review_decision_id || null,
    payload_summary: input.payload_summary || {},
    sequence_index: existing.length,
    occurred_at: new Date().toISOString(),
  };
  return input.repository.appendAuditEvent(event);
}

module.exports = { appendAuditEvent };
