// @ts-check

const { getEvents } = require("./execution-trace-store.ts");
const { ReplayRouter } = require("./replay-router.ts");
const { validateReplayConsistency } = require("./replay-consistency.ts");

/**
 * @param {number} value
 * @returns {number}
 */
function roundScore(value) {
  return Math.round(value * 100) / 100;
}

/**
 * @param {"blocked" | "overridden" | "lower_priority" | "invalid_field" | "invalid_operator"} reason
 * @returns {"blocked_rule" | "overridden" | "lower_priority" | "invalid_field" | "invalid_operator"}
 */
function toSkippedRuleReason(reason) {
  return reason === "blocked" ? "blocked_rule" : reason;
}

/**
 * @param {import("./execution-events.ts").ScoringExecutionEvent[]} events
 * @returns {{
 *   event_count: number,
 *   breakdown: import("./types.ts").ScoreBreakdown,
 *   applied_rules: import("./types.ts").AppliedRule[],
 *   skipped_rules: import("./types.ts").SkippedRule[],
 *   final_score_event_total: number | null,
 *   recomputed_total_score: number | null,
 *   consistency_errors: string[],
 *   blocked_dimensions: import("./types.ts").ScoreDimension[],
 *   blocking_path: string[],
 *   override_path: string[],
 *   execution_context_summary: Record<string, unknown> | null,
 *   event_order: string[]
 * }}
 */
function replayFromEvents(events) {
  /** @type {import("./types.ts").ScoreBreakdown} */
  const breakdown = {
    relevance: 0,
    trust: 0,
    capability: 0,
    risk: 0,
  };
  /** @type {Map<string, import("./execution-events.ts").RuleEvaluationEvent>} */
  const matchedRuleEvents = new Map();
  /** @type {import("./types.ts").AppliedRule[]} */
  const appliedRules = [];
  /** @type {import("./types.ts").SkippedRule[]} */
  const skippedRules = [];
  /** @type {number | null} */
  let finalScoreEventTotal = null;
  /** @type {import("./types.ts").ScoringWeights | null} */
  let scoringWeights = null;
  /** @type {Record<string, unknown> | null} */
  let executionContextSummary = null;
  /** @type {string[]} */
  const consistencyErrors = [];
  /** @type {Set<string>} */
  const appliedRuleIds = new Set();
  /** @type {Set<string>} */
  const terminalRuleEvents = new Set();
  /** @type {Set<import("./types.ts").ScoreDimension>} */
  const blockedDimensions = new Set();
  /** @type {string[]} */
  const blockingPath = [];
  /** @type {string[]} */
  const overridePath = [];
  let lastSequence = -1;

  for (const event of events) {
    if (typeof event.sequence_index === "number") {
      if (event.sequence_index <= lastSequence) {
        consistencyErrors.push(`event_sequence_not_strictly_increasing:${event.event_id}`);
      }
      lastSequence = event.sequence_index;
    } else {
      consistencyErrors.push(`missing_sequence_index:${event.event_id}`);
    }

    if (!executionContextSummary) {
      executionContextSummary = {
        execution_id: event.execution_id,
        lead_id: event.lead_id || null,
        config_version_id: event.config_version_id,
        config_checksum: event.config_checksum || null,
        outcome_policy_id: event.outcome_policy_id || null,
        outcome_policy_version: event.outcome_policy_version || null,
        outcome_policy_checksum: event.outcome_policy_checksum || null,
        engine_version: event.engine_version,
        trigger_source: event.trigger_source || null,
        run_mode: event.run_mode || null,
        idempotency_key: event.idempotency_key || null,
        request_trace_id: event.request_trace_id || null,
        tenant_id: event.tenant_id || null,
      };
    }

    if (!event.config_checksum || !event.outcome_policy_id || !event.outcome_policy_version || !event.outcome_policy_checksum || !event.trigger_source || !event.run_mode || !event.idempotency_key || !event.request_trace_id) {
      consistencyErrors.push(`missing_execution_context_anchor:${event.event_id}`);
    }

    if (!scoringWeights && event.scoring_weights) {
      scoringWeights = event.scoring_weights;
    }

    if (event.event_type === "rule_evaluation") {
      if (terminalRuleEvents.has(event.rule_id)) {
        consistencyErrors.push(`duplicate_rule_terminal_event:${event.rule_id}`);
      }
      terminalRuleEvents.add(event.rule_id);
      if (event.matched) {
        matchedRuleEvents.set(event.rule_id, event);
      }
    }

    if (event.event_type === "rule_skipped") {
      if (terminalRuleEvents.has(event.rule_id)) {
        consistencyErrors.push(`duplicate_rule_terminal_event:${event.rule_id}`);
      }
      terminalRuleEvents.add(event.rule_id);
      skippedRules.push({
        rule_id: event.rule_id,
        rule_type: event.rule_type,
        field: event.field,
        operator: event.operator,
        dimension: event.dimension,
        priority: typeof event.priority === "number" ? event.priority : 0,
        override_group: event.override_group || null,
        skipped_reason: toSkippedRuleReason(event.skipped_reason),
      });
    }

    if (event.event_type === "dimension_score_update") {
      if (appliedRuleIds.has(event.rule_id)) {
        consistencyErrors.push(`duplicate_dimension_update:${event.rule_id}`);
        continue;
      }
      appliedRuleIds.add(event.rule_id);
      breakdown[event.dimension] = event.running_total;
      const ruleEvent = matchedRuleEvents.get(event.rule_id);
      if (ruleEvent) {
        appliedRules.push({
          rule_id: ruleEvent.rule_id,
          rule_type: ruleEvent.rule_type,
          field: ruleEvent.field,
          operator: ruleEvent.operator,
          expected_value: ruleEvent.expected_value === undefined ? null : ruleEvent.expected_value,
          actual_value_summary: ruleEvent.actual_value_summary || "",
          raw_delta: ruleEvent.raw_delta,
          weight: typeof ruleEvent.weight === "number" ? ruleEvent.weight : 0,
          effective_delta: event.delta,
          dimension: event.dimension,
          priority: ruleEvent.priority,
          blocked: ruleEvent.blocked === true,
          skipped_reason: null,
        });
      } else {
        consistencyErrors.push(`dimension_update_without_matched_rule:${event.rule_id}`);
      }
    }

    if (event.event_type === "blocking") {
      blockedDimensions.add(event.dimension);
      blockingPath.push(`${event.dimension}:${event.blocking_rule_id}`);
    }

    if (event.event_type === "override") {
      overridePath.push(`${event.override_group}:${event.selected_rule_id}->[${event.skipped_rule_ids.join(",")}]`);
    }

    if (event.event_type === "final_score") {
      finalScoreEventTotal = event.total_score;
    }
  }

  /** @type {number | null} */
  let recomputedTotalScore = null;
  if (finalScoreEventTotal === null) {
    recomputedTotalScore = null;
  } else if (!scoringWeights) {
    consistencyErrors.push("missing_scoring_weights");
  } else {
    recomputedTotalScore = roundScore(
      breakdown.relevance * scoringWeights.relevance +
        breakdown.trust * scoringWeights.trust +
        breakdown.capability * scoringWeights.capability +
        breakdown.risk * scoringWeights.risk,
    );
    if (recomputedTotalScore !== finalScoreEventTotal) {
      consistencyErrors.push(`final_score_mismatch:expected_${finalScoreEventTotal}_recomputed_${recomputedTotalScore}`);
    }
  }

  return {
    event_count: events.length,
    breakdown,
    applied_rules: appliedRules,
    skipped_rules: skippedRules,
    final_score_event_total: finalScoreEventTotal,
    recomputed_total_score: recomputedTotalScore,
    consistency_errors: consistencyErrors,
    blocked_dimensions: Array.from(blockedDimensions),
    blocking_path: blockingPath,
    override_path: overridePath,
    execution_context_summary: executionContextSummary,
    event_order: events.map((event) => event.event_type),
  };
}

/**
 * Replay is a control plane: decision + routing + validation + execution.
 *
 * @param {string} executionId
 * @param {{ eventStore?: import("./persistence/event-store.interface.ts").EventStore, config_checksum?: string, engine_version?: string }=} options
 */
function replayExecution(executionId, options) {
  const selection = ReplayRouter.selectSource(executionId, options);
  const eventStore = options && options.eventStore;
  /** @type {import("./persistence/event-store.interface.ts").ExecutionSnapshot | null} */
  const snapshot = eventStore && typeof eventStore.getExecutionSnapshot === "function"
    ? eventStore.getExecutionSnapshot(executionId)
    : null;
  /** @type {import("./execution-events.ts").ScoringExecutionEvent[]} */
  let events = [];

  if (selection.source === "snapshot" && snapshot) {
    const consistency = validateReplayConsistency({
      source_used: "snapshot",
      snapshot,
      events,
      recomputed_total_score: snapshot.total_score,
      final_score_event_total: snapshot.total_score,
      consistency_errors: [],
      expected_config_checksum: options && options.config_checksum,
      expected_engine_version: options && options.engine_version,
    });
    const result = {
      execution_id: executionId,
      event_count: snapshot.event_count || 0,
      breakdown: snapshot.breakdown,
      applied_rules: snapshot.applied_rules || [],
      skipped_rules: snapshot.skipped_rules || [],
      final_score_event_total: snapshot.total_score,
      recomputed_total_score: snapshot.total_score,
      final_score: snapshot.total_score,
      total_score: snapshot.total_score,
      is_consistent: consistency.is_consistent,
      consistency_errors: consistency.consistency_errors,
      consistency_result: consistency,
      inconsistency_type: consistency.inconsistency_type,
      blocked_dimensions: snapshot.blocked_dimensions || [],
      blocking_path: [],
      override_path: [],
      execution_context_summary: snapshot.score_result ? snapshot.score_result.execution_context : null,
      source_used: "snapshot",
      selection_reason: selection.selection_reason,
      persistence_source_used: "db_snapshot",
      snapshot_used: true,
      event_order: [],
    };
    if (eventStore && typeof eventStore.markReplayConsistency === "function") {
      eventStore.markReplayConsistency(executionId, {
        execution_id: executionId,
        is_consistent: result.is_consistent,
        consistency_errors: result.consistency_errors,
        recomputed_total_score: result.recomputed_total_score,
        final_score_event_total: result.final_score_event_total,
      });
    }
    return result;
  }

  if (selection.source === "event_store" && eventStore && typeof eventStore.getEvents === "function") {
    events = eventStore.getEvents(executionId);
  } else {
    events = getEvents(executionId);
  }

  const replayed = replayFromEvents(events);
  const consistency = validateReplayConsistency({
    source_used: selection.source,
    snapshot,
    events,
    recomputed_total_score: replayed.recomputed_total_score,
    final_score_event_total: replayed.final_score_event_total,
    consistency_errors: replayed.consistency_errors,
    expected_config_checksum: options && options.config_checksum,
    expected_engine_version: options && options.engine_version,
  });

  const result = {
    execution_id: executionId,
    ...replayed,
    final_score: replayed.final_score_event_total,
    total_score: replayed.recomputed_total_score,
    is_consistent: consistency.is_consistent,
    consistency_errors: consistency.consistency_errors,
    consistency_result: consistency,
    inconsistency_type: consistency.inconsistency_type,
    source_used: selection.source,
    selection_reason: selection.selection_reason,
    persistence_source_used: selection.source === "event_store" ? "db_event_store" : "memory",
    snapshot_used: false,
  };
  if (eventStore && typeof eventStore.markReplayConsistency === "function") {
    eventStore.markReplayConsistency(executionId, {
      execution_id: executionId,
      is_consistent: result.is_consistent,
      consistency_errors: result.consistency_errors,
      recomputed_total_score: result.recomputed_total_score,
      final_score_event_total: result.final_score_event_total,
    });
  }
  return result;
}

module.exports = {
  replayExecution,
  replayFromEvents,
};
