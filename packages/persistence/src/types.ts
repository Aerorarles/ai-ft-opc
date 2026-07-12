// @ts-check

/**
 * @typedef {import("../../phase2-domain/src/types.ts").ExistingLeadSnapshot} ExistingLeadSnapshot
 * @typedef {import("../../phase2-domain/src/types.ts").ShadowRun} ShadowRun
 * @typedef {import("../../phase2-domain/src/types.ts").ShadowResult} ShadowResult
 * @typedef {import("../../phase2-domain/src/types.ts").ShadowDiff} ShadowDiff
 * @typedef {import("../../phase2-domain/src/types.ts").ShadowExplanation} ShadowExplanation
 * @typedef {import("../../phase2-domain/src/types.ts").ReviewQueueItem} ReviewQueueItem
 */

/**
 * @typedef {{ limit?: number }} LeadListQuery
 * @typedef {{ status?: string }} ReviewQueueFilters
 * @typedef {{ review_status: "approved" | "rejected" | "skipped", review_notes?: string }} ReviewDecisionPatch
 */

/**
 * @typedef {"manual" | "api" | "n8n" | "import"} IntakeTriggerSource
 * @typedef {"queued" | "running" | "completed" | "failed" | "blocked"} IntakeRunStatus
 * @typedef {"pending_review"} IntakeCandidateStatus
 */

/**
 * @typedef {Object} IntakeRun
 * @property {string} intake_run_id
 * @property {string} tenant_id
 * @property {string | null} organization_id
 * @property {string | null} actor_user_id
 * @property {string} request_trace_id
 * @property {string} idempotency_key
 * @property {IntakeTriggerSource} trigger_source
 * @property {string} normalization_version
 * @property {string} deduplication_version
 * @property {string} contract_version
 * @property {IntakeRunStatus} run_status
 * @property {number} source_item_count
 * @property {number} candidate_count
 * @property {string | null} error_code
 * @property {string} created_at
 * @property {string | null} completed_at
 */

/**
 * @typedef {Object} IntakeSourceItem
 * @property {string} source_item_id
 * @property {string} intake_run_id
 * @property {IntakeTriggerSource} source_type
 * @property {string | null} source_url
 * @property {string} payload_hash
 * @property {Record<string, unknown>} source_summary
 * @property {string} captured_at
 */

/**
 * @typedef {Object} IntakeCandidateRecord
 * @property {string} candidate_id
 * @property {string} intake_run_id
 * @property {string} source_item_id
 * @property {string} company_name
 * @property {string | null} domain
 * @property {string | null} country
 * @property {string | null} industry
 * @property {boolean} has_email
 * @property {boolean} has_phone
 * @property {string[]} signals
 * @property {IntakeCandidateStatus} candidate_status
 * @property {"not_evaluated"} dedup_status
 * @property {string} normalization_version
 * @property {Record<string, unknown>} normalization_summary
 * @property {string} created_at
 */

module.exports = {};
