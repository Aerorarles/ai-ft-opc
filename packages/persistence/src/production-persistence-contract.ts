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
 * @param {unknown} candidate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePersistenceContractEnvelope(candidate) {
  /** @type {string[]} */
  const errors = [];
  const envelope = /** @type {Partial<PersistenceContractEnvelope>} */ (candidate || {});
  const scope = envelope.scope || {};
  const anchors = envelope.version_anchors || {};

  for (const key of ["tenant_id", "request_trace_id", "idempotency_key"]) {
    if (!isNonEmptyString(scope[key])) errors.push(`missing_scope:${key}`);
  }
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

  /** @type {string[]} */
  const prohibitedKeys = [];
  collectProhibitedKeys(envelope.input_summary, prohibitedKeys);
  collectProhibitedKeys(envelope.audit_summary, prohibitedKeys);
  for (const key of new Set(prohibitedKeys)) errors.push(`prohibited_persistence_key:${key}`);

  return { valid: errors.length === 0, errors };
}

module.exports = {
  PRODUCTION_PERSISTENCE_CONTRACT_VERSION,
  LOGICAL_PERSISTENCE_ENTITIES,
  PROHIBITED_PERSISTENCE_FIELDS,
  validatePersistenceContractEnvelope,
};
