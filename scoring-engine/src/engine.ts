// @ts-check

const { extractFeatures, buildInputSummary, normalizeText } = require("./features.ts");
const { loadConfig, DEFAULT_SCORING_WEIGHTS } = require("./config.ts");
const {
  evaluateRulesWithPrecedence,
  getFeatureValue,
  getRulePriority,
  isBlockingRule,
} = require("./rules.ts");
const { createExecutionContext } = require("./execution-context.ts");
const {
  appendEvent,
  clearExecutionTrace,
  getEvents,
  getExecutionTrace,
} = require("./execution-trace-store.ts");

const ENGINE_VERSION = "0.6";

/**
 * @param {number} value
 * @returns {number}
 */
function roundScore(value) {
  return Math.round(value * 100) / 100;
}

/**
 * @param {Partial<import("./types.ts").ScoringWeights>=} weights
 * @returns {import("./types.ts").ScoringWeights}
 */
function resolveWeights(weights) {
  return {
    relevance: Number(weights && weights.relevance !== undefined ? weights.relevance : DEFAULT_SCORING_WEIGHTS.relevance),
    trust: Number(weights && weights.trust !== undefined ? weights.trust : DEFAULT_SCORING_WEIGHTS.trust),
    capability: Number(weights && weights.capability !== undefined ? weights.capability : DEFAULT_SCORING_WEIGHTS.capability),
    risk: Number(weights && weights.risk !== undefined ? weights.risk : DEFAULT_SCORING_WEIGHTS.risk),
  };
}

/**
 * @param {import("./types.ts").ScoringRule} rule
 * @returns {number}
 */
function getRuleDelta(rule) {
  return typeof rule.score_delta === "number" ? rule.score_delta : 0;
}

/**
 * @param {unknown} value
 * @param {number=} maxLength
 * @returns {string}
 */
function truncateText(value, maxLength = 80) {
  const limit = maxLength || 80;
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}...`;
}

/**
 * @param {import("./types.ts").RuleField} field
 * @param {string | boolean | string[] | null} value
 * @returns {string}
 */
function summarizeActualValue(field, value) {
  if (field === "email" || field === "has_email") {
    return `has_email=${Boolean(value)}`;
  }

  if (field === "phone" || field === "has_phone") {
    return `has_phone=${Boolean(value)}`;
  }

  if (Array.isArray(value)) {
    return `array(count=${value.length}, sample=${truncateText(value.slice(0, 3).join(", "))})`;
  }

  if (typeof value === "boolean") {
    return String(value);
  }

  return truncateText(normalizeText(value));
}

/**
 * @param {unknown} loadedOrRawConfig
 * @returns {import("./types.ts").LoadedScoringConfig}
 */
function resolveLoadedConfig(loadedOrRawConfig) {
  if (
    loadedOrRawConfig &&
    typeof loadedOrRawConfig === "object" &&
    "config" in loadedOrRawConfig &&
    "validation_errors" in loadedOrRawConfig &&
    "is_valid" in loadedOrRawConfig
  ) {
    return loadedOrRawConfig;
  }

  return loadConfig(loadedOrRawConfig);
}

/**
 * Outcome policy mapping is intentionally not implemented yet. v0.3 records
 * that no versioned policy was applied, preserving v0.2 behavior.
 *
 * @returns {{ grade: string | null, priority: string | null, policy_applied: boolean, reason: string }}
 */
function mapOutcomePolicy() {
  return {
    grade: null,
    priority: null,
    policy_applied: false,
    reason: "outcome_policy_not_configured",
  };
}

/**
 * @param {import("./types.ts").ScoringExecutionContext} executionContext
 * @param {import("./types.ts").ScoringWeights | null} scoringWeights
 * @param {import("./persistence/event-store.interface.ts").EventStore=} eventStore
 * @returns {(event: Omit<import("./execution-events.ts").ScoringExecutionEvent, "event_id" | "execution_id" | "timestamp" | "config_version_id" | "config_checksum" | "outcome_policy_id" | "outcome_policy_version" | "outcome_policy_checksum" | "engine_version" | "trigger_source" | "run_mode" | "idempotency_key" | "request_trace_id" | "tenant_id" | "lead_id" | "sequence_index" | "scoring_weights">) => import("./execution-events.ts").ScoringExecutionEvent}
 */
function createEventEmitter(executionContext, scoringWeights, eventStore) {
  let sequence = 0;
  return (event) => {
    const fullEvent = {
      ...event,
      event_id: `${executionContext.execution_id}:${sequence}`,
      execution_id: executionContext.execution_id,
      timestamp: new Date().toISOString(),
      lead_id: executionContext.lead_id,
      config_version_id: executionContext.config_version_id,
      config_checksum: executionContext.config_checksum,
      outcome_policy_id: executionContext.outcome_policy_id,
      outcome_policy_version: executionContext.outcome_policy_version,
      outcome_policy_checksum: executionContext.outcome_policy_checksum,
      engine_version: executionContext.engine_version,
      trigger_source: executionContext.trigger_source,
      run_mode: executionContext.run_mode,
      idempotency_key: executionContext.idempotency_key,
      request_trace_id: executionContext.request_trace_id,
      tenant_id: executionContext.tenant_id,
      scoring_weights: scoringWeights || undefined,
      sequence_index: sequence,
    };
    sequence += 1;
    const memoryEvent = appendEvent(executionContext.execution_id, fullEvent);
    if (eventStore && typeof eventStore.appendEvent === "function") {
      eventStore.appendEvent(executionContext.execution_id, memoryEvent);
    }
    return memoryEvent;
  };
}

/**
 * @param {import("./types.ts").ScoreResult} result
 * @returns {import("./persistence/event-store.interface.ts").ExecutionSnapshot}
 */
function buildSnapshot(result) {
  return {
    execution_id: result.execution_context.execution_id,
    total_score: result.total_score,
    breakdown: result.breakdown,
    applied_rules: result.applied_rules,
    skipped_rules: result.skipped_rules,
    blocked_dimensions: result.blocked_dimensions,
    override_summary: result.override_applied_rules.map((rule) => ({
      rule_id: rule.rule_id,
      dimension: rule.dimension,
      priority: rule.priority || 0,
    })),
    score_result: result,
    is_consistent: true,
    config_checksum: result.execution_context.config_checksum,
    engine_version: result.engine_version,
    event_count: result.event_count,
  };
}

/**
 * @param {import("./persistence/event-store.interface.ts").EventStore | undefined} eventStore
 * @param {import("./types.ts").ScoreResult} result
 * @returns {import("./types.ts").ScoreResult}
 */
function saveSnapshotIfEnabled(eventStore, result) {
  if (eventStore && typeof eventStore.saveSnapshot === "function") {
    eventStore.saveSnapshot(result.execution_context.execution_id, buildSnapshot(result));
  }
  return result;
}

/**
 * @param {"blocked_rule" | "overridden" | "lower_priority" | "invalid_field" | "invalid_operator"} reason
 * @returns {"blocked" | "overridden" | "lower_priority" | "invalid_field" | "invalid_operator"}
 */
function toEventSkippedReason(reason) {
  return reason === "blocked_rule" ? "blocked" : reason;
}

/**
 * @param {import("./execution-events.ts").ScoringExecutionEvent[]} events
 * @param {string} executionId
 * @returns {{ execution_trace_summary: { execution_id: string, event_count: number, event_types: string[] }, event_count: number, rule_execution_path: string[], blocking_path: string[], override_path: string[] }}
 */
function buildTraceExplainability(events, executionId) {
  return {
    execution_trace_summary: {
      execution_id: executionId,
      event_count: events.length,
      event_types: events.map((event) => event.event_type),
    },
    event_count: events.length,
    rule_execution_path: events
      .filter((event) => event.event_type === "rule_evaluation" || event.event_type === "rule_skipped")
      .map((event) => {
        if (event.event_type === "rule_evaluation") {
          return `${event.rule_id}:${event.matched ? "matched" : "not_matched"}`;
        }
        return `${event.rule_id}:skipped:${event.skipped_reason}`;
      }),
    blocking_path: events
      .filter((event) => event.event_type === "blocking")
      .map((event) => `${event.dimension}:${event.blocking_rule_id}`),
    override_path: events
      .filter((event) => event.event_type === "override")
      .map((event) => `${event.override_group}:${event.selected_rule_id}->[${event.skipped_rule_ids.join(",")}]`),
  };
}

/**
 * @param {import("./types.ts").Lead} lead
 * @param {import("./types.ts").ScoringConfig | import("./types.ts").LoadedScoringConfig | unknown} config
 * @param {import("./types.ts").ScoringExecutionContextInput=} executionContextInput
 * @param {{ eventStore?: import("./persistence/event-store.interface.ts").EventStore }=} options
 * @returns {import("./types.ts").ScoreResult}
 */
function scoreLead(lead, config, executionContextInput, options) {
  const loadedConfig = resolveLoadedConfig(config);
  const features = extractFeatures(lead);
  const executionContext = createExecutionContext({
    lead,
    loadedConfig,
    engineVersion: ENGINE_VERSION,
    input: executionContextInput,
  });
  const eventStore = options && options.eventStore;
  if (eventStore && typeof eventStore.getExecutionIdByIdempotencyKey === "function") {
    const existingExecutionId = eventStore.getExecutionIdByIdempotencyKey(executionContext.idempotency_key);
    if (existingExecutionId && typeof eventStore.getExecutionSnapshot === "function") {
      const existingSnapshot = eventStore.getExecutionSnapshot(existingExecutionId);
      if (existingSnapshot && existingSnapshot.score_result) {
        return {
          ...existingSnapshot.score_result,
          persistence_source_used: "event_store_snapshot",
          snapshot_used: true,
          idempotency_reused: true,
        };
      }
    }
    if (typeof eventStore.reserveIdempotencyKey === "function") {
      eventStore.reserveIdempotencyKey(executionContext.idempotency_key, executionContext.execution_id);
    }
  }
  clearExecutionTrace(executionContext.execution_id);
  const weights = loadedConfig.is_valid ? resolveWeights(loadedConfig.config.weights) : null;
  const emitEvent = createEventEmitter(executionContext, weights, eventStore);
  const inputSummary = buildInputSummary(features);
  emitEvent({
    event_type: "feature_extraction",
    extracted_features: inputSummary,
    feature_flags: {
      has_email: features.has_email,
      has_phone: features.has_phone,
      has_website: Boolean(features.website),
      has_signals: features.signals.length > 0,
    },
  });
  /** @type {import("./types.ts").ScoreBreakdown} */
  const breakdown = {
    relevance: 0,
    trust: 0,
    capability: 0,
    risk: 0,
  };

  if (!loadedConfig.is_valid) {
    emitEvent({
      event_type: "final_score",
      total_score: null,
      breakdown,
    });
    const invalidEvents = getEvents(executionContext.execution_id);
    const traceExplainability = buildTraceExplainability(invalidEvents, executionContext.execution_id);
    const invalidResult = {
      engine_version: ENGINE_VERSION,
      config_version: loadedConfig.config.version || null,
      total_score: null,
      breakdown,
      applied_rules: [],
      skipped_rules: [],
      blocked_dimensions: [],
      override_applied_rules: [],
      evaluation_warnings: [],
      validation_errors: loadedConfig.validation_errors,
      validation_warnings: loadedConfig.validation_warnings,
      input_summary: inputSummary,
      execution_context: executionContext,
      outcome: mapOutcomePolicy(),
      persistence_source_used: eventStore ? "event_store" : "memory",
      snapshot_used: false,
      ...traceExplainability,
    };
    return saveSnapshotIfEnabled(eventStore, invalidResult);
  }

  const rules = loadedConfig.config.rules;
  const precedenceResult = evaluateRulesWithPrecedence(rules, features);
  /** @type {import("./types.ts").AppliedRule[]} */
  const appliedRules = [];
  const overrideAppliedRuleIds = new Set(precedenceResult.override_applied_rule_ids);

  for (const evaluation of precedenceResult.evaluated_rules) {
    const actualValue = getFeatureValue(evaluation.rule.field, features);
    emitEvent({
      event_type: "rule_evaluation",
      rule_id: evaluation.rule.id,
      rule_type: evaluation.rule.rule_type,
      field: evaluation.rule.field,
      operator: evaluation.rule.operator,
      matched: evaluation.matched,
      raw_delta: getRuleDelta(evaluation.rule),
      dimension: evaluation.rule.dimension,
      priority: getRulePriority(evaluation.rule),
      weight: weights[evaluation.rule.dimension],
      expected_value: evaluation.rule.value === undefined ? null : evaluation.rule.value,
      actual_value_summary: summarizeActualValue(evaluation.rule.field, actualValue),
      blocked: isBlockingRule(evaluation.rule),
    });
  }

  for (const overrideGroup of precedenceResult.override_groups) {
    emitEvent({
      event_type: "override",
      override_group: overrideGroup.override_group,
      selected_rule_id: overrideGroup.selected_rule_id,
      skipped_rule_ids: overrideGroup.skipped_rule_ids,
    });
  }

  for (const rule of precedenceResult.matched_rules) {
    const dimension = rule.dimension;
    const rawDelta = getRuleDelta(rule);
    const effectiveDelta = rawDelta;
    const actualValue = getFeatureValue(rule.field, features);

    breakdown[dimension] = roundScore(breakdown[dimension] + effectiveDelta);
    emitEvent({
      event_type: "dimension_score_update",
      dimension,
      delta: effectiveDelta,
      running_total: breakdown[dimension],
      rule_id: rule.id,
    });
    if (isBlockingRule(rule)) {
      emitEvent({
        event_type: "blocking",
        dimension,
        blocking_rule_id: rule.id,
      });
    }
    appliedRules.push({
      rule_id: rule.id,
      rule_type: rule.rule_type,
      field: rule.field,
      operator: rule.operator,
      expected_value: rule.value === undefined ? null : rule.value,
      actual_value_summary: summarizeActualValue(rule.field, actualValue),
      raw_delta: rawDelta,
      weight: weights[dimension],
      effective_delta: effectiveDelta,
      dimension,
      priority: getRulePriority(rule),
      blocked: isBlockingRule(rule),
      skipped_reason: null,
    });
  }

  for (const skippedRule of precedenceResult.skipped_rules) {
    emitEvent({
      event_type: "rule_skipped",
      rule_id: skippedRule.rule_id,
      skipped_reason: toEventSkippedReason(skippedRule.skipped_reason),
      rule_type: skippedRule.rule_type,
      field: skippedRule.field,
      operator: skippedRule.operator,
      dimension: skippedRule.dimension,
      priority: skippedRule.priority,
      override_group: skippedRule.override_group,
    });
  }

  const overrideAppliedRules = appliedRules.filter((rule) => overrideAppliedRuleIds.has(rule.rule_id));

  const totalScore = roundScore(
    breakdown.relevance * weights.relevance +
      breakdown.trust * weights.trust +
      breakdown.capability * weights.capability +
      breakdown.risk * weights.risk,
  );
  emitEvent({
    event_type: "final_score",
    total_score: totalScore,
    breakdown,
  });
  const executionTrace = getExecutionTrace(executionContext.execution_id);
  const traceExplainability = buildTraceExplainability(executionTrace.events, executionContext.execution_id);

  const result = {
    engine_version: ENGINE_VERSION,
    config_version: loadedConfig.config.version || null,
    total_score: totalScore,
    breakdown,
    applied_rules: appliedRules,
    skipped_rules: precedenceResult.skipped_rules,
    blocked_dimensions: precedenceResult.blocked_dimensions,
    override_applied_rules: overrideAppliedRules,
    evaluation_warnings: precedenceResult.evaluation_warnings,
    validation_errors: loadedConfig.validation_errors,
    validation_warnings: loadedConfig.validation_warnings,
    input_summary: inputSummary,
    execution_context: executionContext,
    outcome: mapOutcomePolicy(),
    persistence_source_used: eventStore ? "event_store" : "memory",
    snapshot_used: false,
    ...traceExplainability,
  };
  return saveSnapshotIfEnabled(eventStore, result);
}

module.exports = {
  scoreLead,
  DEFAULT_SCORING_WEIGHTS,
  ENGINE_VERSION,
  summarizeActualValue,
};
