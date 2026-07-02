// @ts-check

/**
 * @typedef {"feature_extraction" | "rule_evaluation" | "rule_skipped" | "blocking" | "override" | "dimension_score_update" | "final_score"} ScoringEventType
 * @typedef {"blocked" | "overridden" | "invalid_field" | "invalid_operator" | "lower_priority"} EventSkippedReason
 */

/**
 * @typedef {Object} EventBase
 * @property {string} event_id
 * @property {string} execution_id
 * @property {string} timestamp
 * @property {ScoringEventType} event_type
 * @property {string=} lead_id
 * @property {string} config_version_id
 * @property {string} config_checksum
 * @property {string} outcome_policy_id
 * @property {string} outcome_policy_version
 * @property {string} outcome_policy_checksum
 * @property {string} engine_version
 * @property {import("./types.ts").TriggerSource} trigger_source
 * @property {import("./types.ts").RunMode} run_mode
 * @property {string} idempotency_key
 * @property {string} request_trace_id
 * @property {string=} tenant_id
 * @property {import("./types.ts").ScoringWeights=} scoring_weights
 * @property {number=} sequence_index
 */

/**
 * @typedef {EventBase & {
 *   event_type: "feature_extraction",
 *   extracted_features: import("./types.ts").InputSummary,
 *   feature_flags: {
 *     has_email: boolean,
 *     has_phone: boolean,
 *     has_website: boolean,
 *     has_signals: boolean
 *   }
 * }} FeatureExtractionEvent
 */

/**
 * @typedef {EventBase & {
 *   event_type: "rule_evaluation",
 *   rule_id: string,
 *   rule_type: import("./types.ts").RuleType,
 *   field: import("./types.ts").RuleField,
 *   operator: import("./types.ts").RuleOperator,
 *   matched: boolean,
 *   raw_delta: number,
 *   dimension: import("./types.ts").ScoreDimension,
 *   priority: number,
 *   weight?: number,
 *   expected_value?: string | string[] | boolean | number | null,
 *   actual_value_summary?: string,
 *   blocked?: boolean
 * }} RuleEvaluationEvent
 */

/**
 * @typedef {EventBase & {
 *   event_type: "rule_skipped",
 *   rule_id: string,
 *   skipped_reason: EventSkippedReason,
 *   rule_type?: import("./types.ts").RuleType,
 *   field?: import("./types.ts").RuleField,
 *   operator?: import("./types.ts").RuleOperator,
 *   dimension?: import("./types.ts").ScoreDimension,
 *   priority?: number,
 *   override_group?: string | null
 * }} RuleSkippedEvent
 */

/**
 * @typedef {EventBase & {
 *   event_type: "blocking",
 *   dimension: import("./types.ts").ScoreDimension,
 *   blocking_rule_id: string
 * }} BlockingEvent
 */

/**
 * @typedef {EventBase & {
 *   event_type: "override",
 *   override_group: string,
 *   selected_rule_id: string,
 *   skipped_rule_ids: string[]
 * }} OverrideEvent
 */

/**
 * @typedef {EventBase & {
 *   event_type: "dimension_score_update",
 *   dimension: import("./types.ts").ScoreDimension,
 *   delta: number,
 *   running_total: number,
 *   rule_id: string
 * }} DimensionScoreUpdateEvent
 */

/**
 * @typedef {EventBase & {
 *   event_type: "final_score",
 *   total_score: number | null,
 *   breakdown: import("./types.ts").ScoreBreakdown
 * }} FinalScoreEvent
 */

/**
 * @typedef {FeatureExtractionEvent | RuleEvaluationEvent | RuleSkippedEvent | BlockingEvent | OverrideEvent | DimensionScoreUpdateEvent | FinalScoreEvent} ScoringExecutionEvent
 */

module.exports = {};
