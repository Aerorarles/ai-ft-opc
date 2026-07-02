// @ts-check

const crypto = require("crypto");

const DEFAULT_TENANT_ID = "local";
const DEFAULT_OUTCOME_POLICY_ID = "not-configured";
const DEFAULT_OUTCOME_POLICY_VERSION = "not-configured";
const DEFAULT_OUTCOME_POLICY_CHECKSUM = "not-configured";

/**
 * @param {unknown} value
 * @returns {string}
 */
function hashStableValue(value) {
  const json = JSON.stringify(value || {});
  return crypto.createHash("sha256").update(json).digest("hex");
}

/**
 * @returns {string}
 */
function createExecutionId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString("hex");
}

/**
 * @param {string} executionId
 * @param {string} configChecksum
 * @param {string} tenantId
 * @returns {string}
 */
function createIdempotencyKey(executionId, configChecksum, tenantId) {
  return crypto
    .createHash("sha256")
    .update(`${tenantId}:${executionId}:${configChecksum}`)
    .digest("hex");
}

/**
 * Initialize scoring execution context.
 *
 * @param {{
 *   lead?: import("./types.ts").Lead,
 *   loadedConfig: import("./types.ts").LoadedScoringConfig,
 *   engineVersion: string,
 *   input?: import("./types.ts").ScoringExecutionContextInput
 * }} params
 * @returns {import("./types.ts").ScoringExecutionContext}
 */
function createExecutionContext(params) {
  const input = params.input || {};
  const config = params.loadedConfig.config;
  const configChecksum = input.config_checksum || hashStableValue(config);
  const tenantId = input.tenant_id || DEFAULT_TENANT_ID;
  const executionId = input.execution_id || createExecutionId();

  return {
    execution_id: executionId,
    lead_id: input.lead_id,
    config_version_id: input.config_version_id || config.version || "unknown",
    config_checksum: configChecksum,
    outcome_policy_id: input.outcome_policy_id || DEFAULT_OUTCOME_POLICY_ID,
    outcome_policy_version: input.outcome_policy_version || DEFAULT_OUTCOME_POLICY_VERSION,
    outcome_policy_checksum: input.outcome_policy_checksum || DEFAULT_OUTCOME_POLICY_CHECKSUM,
    engine_version: input.engine_version || params.engineVersion,
    trigger_source: input.trigger_source || "manual",
    run_mode: input.run_mode || "preview",
    idempotency_key: input.idempotency_key || createIdempotencyKey(executionId, configChecksum, tenantId),
    request_trace_id: input.request_trace_id || executionId,
    tenant_id: tenantId,
    replay_source_preference: input.replay_source_preference || "auto",
  };
}

module.exports = {
  createExecutionContext,
  hashStableValue,
};
