// @ts-check

const { getEvents } = require("./execution-trace-store.ts");

/**
 * @param {import("./persistence/event-store.interface.ts").ExecutionSnapshot | null} snapshot
 * @param {{ config_checksum?: string, engine_version?: string }} expected
 * @returns {{ valid: boolean, reason: string }}
 */
function validateSnapshotForRouting(snapshot, expected) {
  if (!snapshot) {
    return { valid: false, reason: "snapshot_missing" };
  }
  if (snapshot.is_consistent !== true) {
    return { valid: false, reason: "snapshot_not_consistent" };
  }
  if (expected.config_checksum && snapshot.config_checksum !== expected.config_checksum) {
    return { valid: false, reason: "snapshot_config_checksum_mismatch" };
  }
  if (expected.engine_version && snapshot.engine_version !== expected.engine_version) {
    return { valid: false, reason: "snapshot_engine_version_mismatch" };
  }
  return { valid: true, reason: "snapshot_valid" };
}

/**
 * @param {import("./execution-events.ts").ScoringExecutionEvent[]} events
 * @returns {boolean}
 */
function hasCompleteEventStream(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return false;
  }
  if (events[0].event_type !== "feature_extraction") {
    return false;
  }
  return events.some((event) => event.event_type === "final_score");
}

class ReplayRouter {
  /**
   * @param {string} execution_id
   * @param {{ eventStore?: import("./persistence/event-store.interface.ts").EventStore, config_checksum?: string, engine_version?: string }=} options
   * @returns {import("./replay-contract.ts").ReplaySelection}
   */
  static selectSource(execution_id, options) {
    const eventStore = options && options.eventStore;
    const expected = {
      config_checksum: options && options.config_checksum,
      engine_version: options && options.engine_version,
    };

    /** @type {import("./persistence/event-store.interface.ts").ExecutionSnapshot | null} */
    let snapshot = null;
    if (eventStore && typeof eventStore.getExecutionSnapshot === "function") {
      snapshot = eventStore.getExecutionSnapshot(execution_id);
    }
    const snapshotValidation = validateSnapshotForRouting(snapshot, expected);
    if (snapshotValidation.valid) {
      return {
        source: "snapshot",
        selection_reason: "snapshot_valid_consistent_checksum_and_engine_match",
        decision_context: {
          execution_id,
          config_checksum: expected.config_checksum || snapshot.config_checksum || null,
          engine_version: expected.engine_version || snapshot.engine_version || null,
          snapshot_status: "valid",
          event_count: snapshot.event_count || 0,
          has_missing_events: false,
          checksum_valid: true,
        },
      };
    }

    if (eventStore && typeof eventStore.getEvents === "function") {
      try {
        const events = eventStore.getEvents(execution_id);
        if (hasCompleteEventStream(events)) {
          return {
            source: "event_store",
            selection_reason: `event_store_fallback_after_${snapshotValidation.reason}`,
            decision_context: {
              execution_id,
              config_checksum: expected.config_checksum || (events[0] && events[0].config_checksum) || null,
              engine_version: expected.engine_version || (events[0] && events[0].engine_version) || null,
              snapshot_status: snapshot ? "invalid" : "missing",
              event_count: events.length,
              has_missing_events: false,
              checksum_valid: true,
            },
          };
        }
      } catch (error) {
        // Router falls through to memory for local/development replay.
      }
    }

    const memoryEvents = getEvents(execution_id);
    return {
      source: "memory",
      selection_reason: eventStore ? "memory_fallback_event_store_unavailable_or_incomplete" : "memory_fallback_local_mode",
      decision_context: {
        execution_id,
        config_checksum: expected.config_checksum || (memoryEvents[0] && memoryEvents[0].config_checksum) || null,
        engine_version: expected.engine_version || (memoryEvents[0] && memoryEvents[0].engine_version) || null,
        snapshot_status: snapshot ? "invalid" : "missing",
        event_count: memoryEvents.length,
        has_missing_events: !hasCompleteEventStream(memoryEvents),
        checksum_valid: true,
      },
    };
  }
}

module.exports = {
  ReplayRouter,
  validateSnapshotForRouting,
  hasCompleteEventStream,
};
