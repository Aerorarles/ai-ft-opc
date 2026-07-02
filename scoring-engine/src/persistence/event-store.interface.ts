// @ts-check

/**
 * @typedef {Object} ExecutionSnapshot
 * @property {string} execution_id
 * @property {number | null} total_score
 * @property {import("../types.ts").ScoreBreakdown} breakdown
 * @property {import("../types.ts").AppliedRule[]} applied_rules
 * @property {import("../types.ts").SkippedRule[]} skipped_rules
 * @property {import("../types.ts").ScoreDimension[]} blocked_dimensions
 * @property {Array<Record<string, unknown>>=} override_summary
 * @property {import("../types.ts").ScoreResult=} score_result
 * @property {boolean=} is_consistent
 * @property {string=} config_checksum
 * @property {string=} engine_version
 * @property {number=} event_count
 */

/**
 * @typedef {Object} ReplayConsistencyResult
 * @property {string} execution_id
 * @property {boolean} is_consistent
 * @property {string[]} consistency_errors
 * @property {number | null} recomputed_total_score
 * @property {number | null} final_score_event_total
 */

/**
 * EventStore interface for future persistent scoring event storage.
 *
 * This file intentionally defines only a local interface contract. It does not
 * connect to PostgreSQL, execute SQL, or perform network operations.
 *
 * @typedef {Object} EventStore
 * @property {(execution_id: string, event: import("../execution-events.ts").ScoringExecutionEvent) => import("../execution-events.ts").ScoringExecutionEvent | Promise<import("../execution-events.ts").ScoringExecutionEvent>} appendEvent
 * @property {(execution_id: string) => import("../execution-events.ts").ScoringExecutionEvent[] | Promise<import("../execution-events.ts").ScoringExecutionEvent[]>} getEvents
 * @property {(execution_id: string) => ExecutionSnapshot | null | Promise<ExecutionSnapshot | null>} getExecutionSnapshot
 * @property {(execution_id: string, snapshot: ExecutionSnapshot) => ExecutionSnapshot | Promise<ExecutionSnapshot>} saveSnapshot
 * @property {(execution_id: string, result: ReplayConsistencyResult) => void | Promise<void>} markReplayConsistency
 * @property {(idempotency_key: string) => string | null | Promise<string | null>=} getExecutionIdByIdempotencyKey
 * @property {(idempotency_key: string, execution_id: string) => void | Promise<void>=} reserveIdempotencyKey
 */

module.exports = {};
