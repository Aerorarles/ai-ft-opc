// @ts-check

/**
 * @param {string[]} errors
 * @returns {import("./replay-contract.ts").InconsistencyType}
 */
function classifyErrors(errors) {
  if (errors.length === 0) {
    return "NONE";
  }
  if (errors.some((error) => error.includes("missing") || error.includes("without_matched_rule"))) {
    return "MISSING_EVENTS";
  }
  if (errors.some((error) => error.includes("checksum_mismatch"))) {
    return "CHECKSUM_MISMATCH";
  }
  if (errors.some((error) => error.includes("engine_version_mismatch"))) {
    return "ENGINE_VERSION_MISMATCH";
  }
  if (errors.some((error) => error.includes("config_mismatch"))) {
    return "CONFIG_MISMATCH";
  }
  if (errors.some((error) => error.includes("sequence") || error.includes("order"))) {
    return "ORDER_CORRUPTION";
  }
  if (errors.some((error) => error.includes("final_score_mismatch") || error.includes("snapshot_mismatch"))) {
    return "RERUN_DIFFERENCE";
  }
  return "RERUN_DIFFERENCE";
}

/**
 * @param {{
 *   source_used: import("./replay-contract.ts").ReplaySource,
 *   snapshot?: import("./persistence/event-store.interface.ts").ExecutionSnapshot | null,
 *   events?: import("./execution-events.ts").ScoringExecutionEvent[],
 *   recomputed_total_score: number | null,
 *   final_score_event_total: number | null,
 *   consistency_errors: string[],
 *   expected_config_checksum?: string,
 *   expected_engine_version?: string
 * }} params
 * @returns {{ is_consistent: boolean, consistency_errors: string[], inconsistency_type: import("./replay-contract.ts").InconsistencyType }}
 */
function validateReplayConsistency(params) {
  const errors = [...(params.consistency_errors || [])];
  const events = params.events || [];
  const snapshot = params.snapshot || null;

  if (snapshot && params.recomputed_total_score !== null && snapshot.total_score !== params.recomputed_total_score) {
    errors.push(`snapshot_mismatch:expected_${snapshot.total_score}_recomputed_${params.recomputed_total_score}`);
  }

  if (snapshot && typeof snapshot.event_count === "number" && events.length > 0 && snapshot.event_count !== events.length) {
    errors.push(`event_count_mismatch:snapshot_${snapshot.event_count}_events_${events.length}`);
  }

  if (events.length > 0) {
    if (!events.some((event) => event.event_type === "feature_extraction") || !events.some((event) => event.event_type === "final_score")) {
      errors.push("missing_required_event");
    }
    if (params.expected_config_checksum && events.some((event) => event.config_checksum !== params.expected_config_checksum)) {
      errors.push("checksum_mismatch");
    }
    if (params.expected_engine_version && events.some((event) => event.engine_version !== params.expected_engine_version)) {
      errors.push("engine_version_mismatch");
    }
    const sorted = [...events].sort((left, right) => (left.sequence_index || 0) - (right.sequence_index || 0));
    if (sorted.some((event, index) => event !== events[index])) {
      errors.push("ordering_mismatch");
    }
  } else if (params.source_used !== "snapshot") {
    errors.push("missing_events");
  }

  const inconsistencyType = classifyErrors(errors);
  return {
    is_consistent: inconsistencyType === "NONE",
    consistency_errors: errors,
    inconsistency_type: inconsistencyType,
  };
}

module.exports = {
  validateReplayConsistency,
  classifyErrors,
};
