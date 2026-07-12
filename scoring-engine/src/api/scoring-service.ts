// @ts-check

const { loadConfig } = require("../config.ts");
const { scoreLead } = require("../engine.ts");
const { hashStableValue } = require("../execution-context.ts");
const { replayExecution } = require("../replay.ts");
const { ReplayRouter } = require("../replay-router.ts");
const defaultConfigJson = require("../../../scoring-config/v1.json");

const DEFAULT_TENANT_ID = "local";

/**
 * @param {unknown} input
 * @returns {string}
 */
function stableId(input) {
  return `api-${hashStableValue(input).slice(0, 32)}`;
}

/**
 * @param {string} tenantId
 * @param {string} configVersionId
 * @param {Record<string, Record<string, unknown>>=} tenantConfigs
 * @returns {unknown}
 */
function resolveTenantConfig(tenantId, configVersionId, tenantConfigs) {
  const registry = tenantConfigs || {
    [DEFAULT_TENANT_ID]: {
      [defaultConfigJson.version]: defaultConfigJson,
    },
  };
  const tenantRegistry = registry[tenantId];
  if (!tenantRegistry) {
    throw new Error(`Tenant is not registered for scoring: ${tenantId}`);
  }
  const config = tenantRegistry[configVersionId];
  if (!config) {
    throw new Error(`Config version is not available for tenant: ${tenantId}/${configVersionId}`);
  }
  return config;
}

class ShadowEventStore {
  /** @type {import("../persistence/event-store.interface.ts").EventStore} */
  inner;

  /**
   * @param {import("../persistence/event-store.interface.ts").EventStore} inner
   */
  constructor(inner) {
    this.inner = inner;
  }

  appendEvent(execution_id, event) {
    return this.inner.appendEvent(execution_id, event);
  }

  getEvents(execution_id) {
    return this.inner.getEvents(execution_id);
  }

  getExecutionSnapshot(execution_id) {
    return null;
  }

  saveSnapshot(execution_id, snapshot) {
    return snapshot;
  }

  markReplayConsistency(execution_id, result) {
    if (typeof this.inner.markReplayConsistency === "function") {
      return this.inner.markReplayConsistency(execution_id, result);
    }
  }

  getExecutionIdByIdempotencyKey(idempotency_key) {
    if (typeof this.inner.getExecutionIdByIdempotencyKey === "function") {
      return this.inner.getExecutionIdByIdempotencyKey(idempotency_key);
    }
    return null;
  }

  reserveIdempotencyKey(idempotency_key, execution_id) {
    if (typeof this.inner.reserveIdempotencyKey === "function") {
      return this.inner.reserveIdempotencyKey(idempotency_key, execution_id);
    }
  }
}

/**
 * Productized local API service facade. This function does not start a server,
 * connect to a database, call n8n, or access external APIs.
 *
 * @param {{
 *   lead: import("../types.ts").Lead,
 *   config_version_id: string,
 *   tenant_id: string,
 *   request_trace_id: string,
 *   run_mode: import("../types.ts").RunMode,
 *   idempotency_key?: string
 * }} request
 * @param {{
 *   tenantConfigs?: Record<string, Record<string, unknown>>,
 *   eventStore?: import("../persistence/event-store.interface.ts").EventStore
 * }=} options
 * @returns {{
 *   execution_id: string,
 *   total_score: number | null,
 *   breakdown: import("../types.ts").ScoreBreakdown,
 *   applied_rules: import("../types.ts").AppliedRule[],
 *   replay_source_used: import("../replay-contract.ts").ReplaySource,
 *   consistency_result: Record<string, unknown>,
 *   explanation: Record<string, unknown>,
 *   replay_metadata: Record<string, unknown>
 * }}
 */
function scoreLeadAPI(request, options) {
  const configJson = resolveTenantConfig(request.tenant_id, request.config_version_id, options && options.tenantConfigs);
  const loadedConfig = loadConfig(configJson);
  const idempotencyKey = request.idempotency_key || hashStableValue({
    tenant_id: request.tenant_id,
    config_version_id: request.config_version_id,
    run_mode: request.run_mode,
    lead: request.lead,
  });
  const executionId = stableId({
    tenant_id: request.tenant_id,
    config_version_id: request.config_version_id,
    run_mode: request.run_mode,
    idempotency_key: idempotencyKey,
  });

  const baseContext = {
    execution_id: executionId,
    config_version_id: request.config_version_id,
    tenant_id: request.tenant_id,
    request_trace_id: request.request_trace_id,
    trigger_source: "api",
    run_mode: request.run_mode,
    idempotency_key: idempotencyKey,
    replay_source_preference: "auto",
  };

  const eventStore = options && options.eventStore;
  const scoringOptions = request.run_mode === "live" && eventStore
    ? { eventStore }
    : request.run_mode === "shadow" && eventStore
      ? { eventStore: new ShadowEventStore(eventStore) }
      : undefined;

  const scoreResult = scoreLead(request.lead, loadedConfig, baseContext, scoringOptions);
  const replayOptions = request.run_mode === "preview"
    ? {
      config_checksum: scoreResult.execution_context.config_checksum,
      engine_version: scoreResult.engine_version,
    }
    : scoringOptions && scoringOptions.eventStore
      ? {
        eventStore: scoringOptions.eventStore,
        config_checksum: scoreResult.execution_context.config_checksum,
        engine_version: scoreResult.engine_version,
      }
      : {
        config_checksum: scoreResult.execution_context.config_checksum,
        engine_version: scoreResult.engine_version,
      };

  const selection = ReplayRouter.selectSource(scoreResult.execution_context.execution_id, replayOptions);
  const replay = replayExecution(scoreResult.execution_context.execution_id, replayOptions);

  return {
    execution_id: scoreResult.execution_context.execution_id,
    total_score: scoreResult.total_score,
    breakdown: scoreResult.breakdown,
    applied_rules: scoreResult.applied_rules,
    replay_source_used: replay.source_used || selection.source,
    consistency_result: replay.consistency_result,
    explanation: {
      input_summary: scoreResult.input_summary,
      rule_execution_path: scoreResult.rule_execution_path,
      blocking_path: scoreResult.blocking_path,
      override_path: scoreResult.override_path,
      validation_errors: scoreResult.validation_errors,
      validation_warnings: scoreResult.validation_warnings,
    },
    replay_metadata: {
      source_used: replay.source_used || selection.source,
      selection_reason: replay.selection_reason || selection.selection_reason,
      snapshot_used: replay.snapshot_used === true,
      is_consistent: replay.is_consistent,
      inconsistency_type: replay.inconsistency_type,
      recomputed_total_score: replay.recomputed_total_score,
      final_score_event_total: replay.final_score_event_total,
      config_checksum: scoreResult.execution_context.config_checksum,
      engine_version: scoreResult.execution_context.engine_version,
      outcome_policy_id: scoreResult.execution_context.outcome_policy_id,
      outcome_policy_version: scoreResult.execution_context.outcome_policy_version,
      outcome_policy_checksum: scoreResult.execution_context.outcome_policy_checksum,
      run_mode: request.run_mode,
      tenant_id: request.tenant_id,
      config_version_id: request.config_version_id,
    },
  };
}

module.exports = {
  scoreLeadAPI,
  ShadowEventStore,
  resolveTenantConfig,
};
