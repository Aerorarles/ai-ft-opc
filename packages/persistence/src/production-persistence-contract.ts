// @ts-check

/**
 * M1-WP01 的逻辑持久化契约。它只定义脱敏数据的形状和校验边界，
 * 不连接数据库、不执行 SQL，也不替代后续获批的 migration。
 */

const PRODUCTION_PERSISTENCE_CONTRACT_VERSION = "m1-wp01-draft";

const LOGICAL_PERSISTENCE_ENTITIES = Object.freeze([
  "lead_snapshot",
  "shadow_scoring_run",
  "shadow_scoring_result",
  "shadow_scoring_diff",
  "review_queue_item",
  "review_decision",
  "audit_event",
]);

const PROHIBITED_PERSISTENCE_FIELDS = Object.freeze([
  "email",
  "phone",
  "contact_name",
  "raw_data",
  "html",
  "headers",
  "cookies",
  "stack",
  "response",
  "credential",
  "credentials",
  "api_key",
  "password",
  "token",
  "connection_string",
]);

/**
 * @typedef {Object} PersistenceScope
 * @property {string} tenant_id
 * @property {string | null} organization_id
 * @property {string | null} actor_user_id
 * @property {string} request_trace_id
 * @property {string} idempotency_key
 */

/**
 * @typedef {Object} ScoringVersionAnchors
 * @property {string} config_version_id
 * @property {string} config_checksum
 * @property {string} engine_version
 * @property {string} outcome_policy_id
 * @property {string} outcome_policy_version
 * @property {string} outcome_policy_checksum
 */

/**
 * @typedef {Object} PersistenceContractEnvelope
 * @property {PersistenceScope} scope
 * @property {ScoringVersionAnchors} version_anchors
 * @property {"preview" | "shadow" | "live" | "replay"} run_mode
 * @property {Record<string, unknown>=} input_summary
 * @property {Record<string, unknown>=} audit_summary
 */

/**
 * @typedef {Object} IntakeVersionAnchors
 * @property {string} normalization_version
 * @property {string} deduplication_version
 * @property {string} contract_version
 */

/**
 * @typedef {Object} IntakePersistenceEnvelope
 * @property {PersistenceScope} scope
 * @property {IntakeVersionAnchors} version_anchors
 * @property {"manual" | "api" | "n8n" | "import"} trigger_source
 * @property {Record<string, unknown>=} source_summary
 * @property {Record<string, unknown>=} candidate_summary
 */

/**
 * M1-WP03 shadow persistence envelope. This is a local validation contract;
 * it does not connect to PostgreSQL or execute the DRAFT migration.
 *
 * @typedef {Object} ShadowPersistenceEnvelope
 * @property {PersistenceScope} scope
 * @property {ScoringVersionAnchors} version_anchors
 * @property {"shadow"} run_mode
 * @property {Record<string, unknown>=} input_summary
 * @property {Record<string, unknown>=} result_summary
 * @property {Record<string, unknown>=} diff_summary
 * @property {Record<string, unknown>[]=} explanations
 */

/**
 * M1-WP04 review persistence envelope. This remains a local validation
 * contract and does not connect to PostgreSQL or execute DRAFT-006.
 *
 * @typedef {Object} ReviewPersistenceEnvelope
 * @property {PersistenceScope} scope
 * @property {{ review_item_id: string, lead_id: string, shadow_result_id: string, review_status: string }} review_item
 * @property {{ decision: string, decided_by: string, decision_notes_summary?: string | null }=} decision
 */

/**
 * @typedef {Object} AuditPersistenceEnvelope
 * @property {PersistenceScope} scope
 * @property {string} event_type
 * @property {string} entity_type
 * @property {string} entity_id
 * @property {Record<string, unknown>=} payload_summary
 */

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * 检查对象键名而非值，避免校验路径本身暴露任何敏感原文。
 * @param {unknown} value
 * @param {string[]} found
 */
function collectProhibitedKeys(value, found) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = key.trim().toLowerCase();
    if (PROHIBITED_PERSISTENCE_FIELDS.includes(normalizedKey)) {
      found.push(normalizedKey);
    }
    collectProhibitedKeys(nested, found);
  }
}

/**
 * @param {Partial<PersistenceScope>} scope
 * @param {string[]} errors
 */
function validateScope(scope, errors) {
  for (const key of ["tenant_id", "request_trace_id", "idempotency_key"]) {
    if (!isNonEmptyString(scope[key])) errors.push(`missing_scope:${key}`);
  }
}

/**
 * @param {unknown[]} values
 * @param {string[]} errors
 */
function appendProhibitedKeyErrors(values, errors) {
  /** @type {string[]} */
  const prohibitedKeys = [];
  for (const value of values) collectProhibitedKeys(value, prohibitedKeys);
  for (const key of new Set(prohibitedKeys)) errors.push(`prohibited_persistence_key:${key}`);
}

/**
 * @param {unknown} candidate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePersistenceContractEnvelope(candidate) {
  /** @type {string[]} */
  const errors = [];
  const envelope = /** @type {Partial<PersistenceContractEnvelope>} */ (candidate || {});
  const scope = envelope.scope || {};
  const anchors = envelope.version_anchors || {};

  validateScope(scope, errors);
  for (const key of [
    "config_version_id",
    "config_checksum",
    "engine_version",
    "outcome_policy_id",
    "outcome_policy_version",
    "outcome_policy_checksum",
  ]) {
    if (!isNonEmptyString(anchors[key])) errors.push(`missing_version_anchor:${key}`);
  }
  if (!isNonEmptyString(envelope.run_mode)) errors.push("missing_run_mode");

  appendProhibitedKeyErrors([envelope.input_summary, envelope.audit_summary], errors);

  return { valid: errors.length === 0, errors };
}

/**
 * @param {unknown} candidate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateIntakePersistenceEnvelope(candidate) {
  /** @type {string[]} */
  const errors = [];
  const envelope = /** @type {Partial<IntakePersistenceEnvelope>} */ (candidate || {});
  const scope = envelope.scope || {};
  const anchors = envelope.version_anchors || {};

  validateScope(scope, errors);
  for (const key of ["normalization_version", "deduplication_version", "contract_version"]) {
    if (!isNonEmptyString(anchors[key])) errors.push(`missing_intake_version_anchor:${key}`);
  }
  if (!isNonEmptyString(envelope.trigger_source)) errors.push("missing_trigger_source");
  appendProhibitedKeyErrors([envelope.source_summary, envelope.candidate_summary], errors);

  return { valid: errors.length === 0, errors };
}

/**
 * @param {unknown} candidate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateShadowPersistenceEnvelope(candidate) {
  /** @type {string[]} */
  const errors = [];
  const envelope = /** @type {Partial<ShadowPersistenceEnvelope>} */ (candidate || {});
  const scope = envelope.scope || {};
  const anchors = envelope.version_anchors || {};

  validateScope(scope, errors);
  for (const key of [
    "config_version_id",
    "config_checksum",
    "engine_version",
    "outcome_policy_id",
    "outcome_policy_version",
    "outcome_policy_checksum",
  ]) {
    if (!isNonEmptyString(anchors[key])) errors.push(`missing_shadow_version_anchor:${key}`);
  }
  if (envelope.run_mode !== "shadow") errors.push("shadow_run_mode_required");
  appendProhibitedKeyErrors([
    envelope.input_summary,
    envelope.result_summary,
    envelope.diff_summary,
    ...(Array.isArray(envelope.explanations) ? envelope.explanations : []),
  ], errors);

  return { valid: errors.length === 0, errors };
}

/**
 * @param {unknown} candidate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateReviewPersistenceEnvelope(candidate) {
  /** @type {string[]} */
  const errors = [];
  const envelope = /** @type {Partial<ReviewPersistenceEnvelope>} */ (candidate || {});
  const scope = envelope.scope || {};
  const item = envelope.review_item || {};
  const decision = envelope.decision;
  const validStatuses = ["pending", "approved", "rejected", "skipped"];
  const terminalStatuses = ["approved", "rejected", "skipped"];

  validateScope(scope, errors);
  for (const key of ["review_item_id", "lead_id", "shadow_result_id"]) {
    if (!isNonEmptyString(item[key])) errors.push(`missing_review_item:${key}`);
  }
  if (!validStatuses.includes(String(item.review_status || ""))) errors.push("invalid_review_status");
  if (decision) {
    if (!terminalStatuses.includes(String(decision.decision || ""))) errors.push("invalid_review_decision");
    if (!isNonEmptyString(decision.decided_by)) errors.push("missing_reviewer_identity");
    if (decision.decision !== item.review_status) errors.push("review_status_decision_mismatch");
    if (
      decision.decision_notes_summary !== undefined &&
      decision.decision_notes_summary !== null &&
      !/^note_present\(length=\d+\)$/.test(String(decision.decision_notes_summary))
    ) {
      errors.push("invalid_review_note_summary");
    }
  } else if (item.review_status !== "pending") {
    errors.push("terminal_review_requires_decision");
  }
  appendProhibitedKeyErrors([item, decision], errors);

  return { valid: errors.length === 0, errors };
}

/** @param {unknown} candidate @returns {{ valid: boolean, errors: string[] }} */
function validateAuditPersistenceEnvelope(candidate) {
  /** @type {string[]} */
  const errors = [];
  const envelope = /** @type {Partial<AuditPersistenceEnvelope>} */ (candidate || {});
  const eventTypes = ["intake_completed", "shadow_persisted", "review_decided"];
  validateScope(envelope.scope || {}, errors);
  if (!eventTypes.includes(String(envelope.event_type || ""))) errors.push("invalid_audit_event_type");
  if (!isNonEmptyString(envelope.entity_type)) errors.push("missing_audit_entity_type");
  if (!isNonEmptyString(envelope.entity_id)) errors.push("missing_audit_entity_id");
  appendProhibitedKeyErrors([envelope.payload_summary], errors);
  return { valid: errors.length === 0, errors };
}

module.exports = {
  PRODUCTION_PERSISTENCE_CONTRACT_VERSION,
  LOGICAL_PERSISTENCE_ENTITIES,
  PROHIBITED_PERSISTENCE_FIELDS,
  validatePersistenceContractEnvelope,
  validateIntakePersistenceEnvelope,
  validateShadowPersistenceEnvelope,
  validateReviewPersistenceEnvelope,
  validateAuditPersistenceEnvelope,
};
