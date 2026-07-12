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

module.exports = {
  PRODUCTION_PERSISTENCE_CONTRACT_VERSION,
  LOGICAL_PERSISTENCE_ENTITIES,
  PROHIBITED_PERSISTENCE_FIELDS,
  validatePersistenceContractEnvelope,
  validateIntakePersistenceEnvelope,
  validateShadowPersistenceEnvelope,
};
