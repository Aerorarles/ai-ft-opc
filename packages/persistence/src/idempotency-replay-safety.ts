// @ts-check

const { createHash } = require("node:crypto");

const IDEMPOTENCY_OPERATIONS = Object.freeze([
  "intake_submission",
  "shadow_run",
  "review_action",
  "audit_event",
]);

const REPLAY_EVENT_ORDER = Object.freeze([
  "intake_completed",
  "shadow_persisted",
  "review_decided",
]);

/** @param {unknown} value */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Produce a stable operation key without retaining the entity identifier in
 * the key itself. Callers may still supply an approved external key.
 *
 * @param {{ operation: typeof IDEMPOTENCY_OPERATIONS[number], request_trace_id: string, entity_id: string }} input
 */
function buildIdempotencyKey(input) {
  const material = `${input.operation}:${input.request_trace_id}:${input.entity_id}`;
  const digest = createHash("sha256").update(material).digest("hex").slice(0, 24);
  return `${input.operation}:${digest}`;
}

/**
 * Validate common operation scope before a repository can mutate. Validation
 * only returns error codes and never includes caller-supplied values.
 *
 * @param {unknown} candidate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateIdempotencyReplayEnvelope(candidate) {
  /** @type {string[]} */
  const errors = [];
  const input = /** @type {{ tenant_id?: unknown, request_trace_id?: unknown, idempotency_key?: unknown, operation?: unknown, replay_behavior?: unknown }} */ (candidate || {});
  if (!isNonEmptyString(input.tenant_id)) errors.push("missing_idempotency_scope:tenant_id");
  if (!isNonEmptyString(input.request_trace_id)) errors.push("missing_idempotency_scope:request_trace_id");
  if (!isNonEmptyString(input.idempotency_key)) errors.push("missing_idempotency_scope:idempotency_key");
  if (!IDEMPOTENCY_OPERATIONS.includes(/** @type {any} */ (input.operation))) errors.push("invalid_idempotency_operation");
  if (input.replay_behavior !== "reuse_existing" && input.replay_behavior !== "audit_only") {
    errors.push("invalid_replay_behavior");
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Audit-only replay: reconstructs trace safety from prior sanitized events.
 * It intentionally never calls an intake, scoring, review, or agent function.
 *
 * @param {{ request_trace_id: string, events: import("./types.ts").AuditEvent[], expected_event_types?: string[] }} input
 */
function auditReplaySafety(input) {
  /** @type {string[]} */
  const consistency_errors = [];
  const events = Array.isArray(input.events) ? [...input.events] : [];
  const expected = input.expected_event_types || [];
  const traceEvents = events.filter((event) => event.request_trace_id === input.request_trace_id);

  if (traceEvents.length === 0) consistency_errors.push("empty_audit_event_stream");
  if (traceEvents.length !== events.length) consistency_errors.push("mixed_request_trace_id");

  /** @type {Set<string>} */
  const keys = new Set();
  let lastSequence = -1;
  let lastOrder = -1;
  for (const event of traceEvents) {
    if (!Number.isInteger(event.sequence_index) || event.sequence_index !== lastSequence + 1) {
      consistency_errors.push("non_contiguous_audit_sequence");
    }
    lastSequence = event.sequence_index;
    const eventKey = `${event.tenant_id}:${event.idempotency_key}`;
    if (keys.has(eventKey)) consistency_errors.push("duplicate_audit_idempotency_key");
    keys.add(eventKey);
    const eventOrder = REPLAY_EVENT_ORDER.indexOf(event.event_type);
    if (eventOrder >= 0 && eventOrder < lastOrder) consistency_errors.push("audit_event_order_violation");
    if (eventOrder >= 0) lastOrder = eventOrder;
  }

  for (const eventType of expected) {
    if (!traceEvents.some((event) => event.event_type === eventType)) {
      consistency_errors.push(`missing_expected_audit_event:${eventType}`);
    }
  }

  const uniqueErrors = [...new Set(consistency_errors)];
  return {
    replay_mode: "audit_only",
    request_trace_id: input.request_trace_id,
    event_count: traceEvents.length,
    event_types: traceEvents.map((event) => event.event_type),
    is_consistent: uniqueErrors.length === 0,
    consistency_errors: uniqueErrors,
    replay_summary: uniqueErrors.length === 0
      ? "sanitized_audit_trace_consistent"
      : "sanitized_audit_trace_requires_review",
  };
}

module.exports = {
  IDEMPOTENCY_OPERATIONS,
  REPLAY_EVENT_ORDER,
  buildIdempotencyKey,
  validateIdempotencyReplayEnvelope,
  auditReplaySafety,
};
