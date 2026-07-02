// @ts-check

/**
 * @typedef {"snapshot" | "event_store" | "memory"} ReplaySource
 * @typedef {"NONE" | "MISSING_EVENTS" | "CHECKSUM_MISMATCH" | "ENGINE_VERSION_MISMATCH" | "CONFIG_MISMATCH" | "RERUN_DIFFERENCE" | "ORDER_CORRUPTION"} InconsistencyType
 */

/**
 * Replay decision contract shared by router, replay execution, and consistency
 * arbitration. This is a local TypeScript/JSDoc contract only.
 *
 * @typedef {Object} ReplayDecisionContext
 * @property {string} execution_id
 * @property {string | null} config_checksum
 * @property {string | null} engine_version
 * @property {"missing" | "valid" | "invalid"} snapshot_status
 * @property {number} event_count
 * @property {boolean} has_missing_events
 * @property {boolean} checksum_valid
 */

/**
 * @typedef {Object} ReplaySelection
 * @property {ReplaySource} source
 * @property {string} selection_reason
 * @property {ReplayDecisionContext} decision_context
 */

module.exports = {};
