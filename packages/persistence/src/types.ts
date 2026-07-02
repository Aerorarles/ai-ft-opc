// @ts-check

/**
 * @typedef {import("../../phase2-domain/src/types.ts").ExistingLeadSnapshot} ExistingLeadSnapshot
 * @typedef {import("../../phase2-domain/src/types.ts").ShadowRun} ShadowRun
 * @typedef {import("../../phase2-domain/src/types.ts").ShadowResult} ShadowResult
 * @typedef {import("../../phase2-domain/src/types.ts").ShadowDiff} ShadowDiff
 * @typedef {import("../../phase2-domain/src/types.ts").ReviewQueueItem} ReviewQueueItem
 */

/**
 * @typedef {{ limit?: number }} LeadListQuery
 * @typedef {{ status?: string }} ReviewQueueFilters
 * @typedef {{ review_status: "approved" | "rejected" | "skipped", review_notes?: string }} ReviewDecisionPatch
 */

module.exports = {};
