// @ts-check

/**
 * @typedef {"HOT" | "WARM" | "COLD"} DecisionAction
 * @typedef {"pending" | "approved" | "rejected" | "skipped"} ReviewStatus
 * @typedef {"queued" | "running" | "succeeded" | "partial" | "failed" | "blocked"} ShadowRunStatus
 */

/**
 * @typedef {Object} ExistingLeadSnapshot
 * @property {string} id
 * @property {string} company_name
 * @property {string | null} website_summary
 * @property {string | null} country
 * @property {string | null} industry
 * @property {string | null} source
 * @property {boolean} has_email
 * @property {boolean} has_phone
 * @property {string | null} enrichment_status
 * @property {number} v01_score
 * @property {string | null} v01_grade
 * @property {string | null} v01_priority
 * @property {Record<string, unknown>} v01_score_breakdown_summary
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} ShadowRun
 * @property {string} shadow_run_id
 * @property {"shadow"} run_mode
 * @property {string} trigger_source
 * @property {string} request_trace_id
 * @property {string} config_version
 * @property {string} config_checksum
 * @property {string} engine_version
 * @property {ShadowRunStatus} run_status
 * @property {number} lead_count
 * @property {string | null} started_at
 * @property {string | null} completed_at
 * @property {string | null} error_summary
 * @property {string} created_at
 */

/**
 * @typedef {Object} ShadowResult
 * @property {string} shadow_result_id
 * @property {string} shadow_run_id
 * @property {string} lead_id
 * @property {number | null} shadow_score
 * @property {Record<string, unknown>} breakdown_summary
 * @property {number} applied_rule_count
 * @property {string} config_version
 * @property {string} config_checksum
 * @property {string} engine_version
 * @property {boolean} replay_consistency
 * @property {string} inconsistency_type
 * @property {Record<string, unknown>} input_summary
 * @property {string} created_at
 */

/**
 * @typedef {Object} ShadowDiff
 * @property {string} shadow_diff_id
 * @property {string} shadow_result_id
 * @property {string} lead_id
 * @property {number} v01_score
 * @property {string | null} v01_grade
 * @property {string | null} v01_priority
 * @property {number | null} shadow_score
 * @property {number | null} score_delta
 * @property {"same" | "different" | "not_evaluated"} grade_diff_status
 * @property {"same" | "different" | "not_evaluated"} priority_diff_status
 * @property {boolean} requires_review
 * @property {Record<string, unknown>} diff_summary
 * @property {string} created_at
 */

/**
 * @typedef {Object} ReviewQueueItem
 * @property {string} review_item_id
 * @property {string} lead_id
 * @property {string} shadow_result_id
 * @property {DecisionAction} decision_action
 * @property {number} decision_confidence
 * @property {string[]} decision_reasons
 * @property {string[]} risk_flags
 * @property {string} recommended_next_step
 * @property {ReviewStatus} review_status
 * @property {string | null} review_notes
 * @property {string | null} reviewed_at
 * @property {string} created_at
 * @property {string} updated_at
 */

module.exports = {};
