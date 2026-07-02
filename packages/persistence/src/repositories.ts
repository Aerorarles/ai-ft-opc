// @ts-check

/**
 * @typedef {{
 *   getLeadSnapshot(leadId: string): Promise<import("./types.ts").ExistingLeadSnapshot | null>,
 *   listLeadSnapshots(query?: import("./types.ts").LeadListQuery): Promise<import("./types.ts").ExistingLeadSnapshot[]>,
 *   seedLeadSnapshot(snapshot: import("./types.ts").ExistingLeadSnapshot): Promise<import("./types.ts").ExistingLeadSnapshot>
 * }} LeadRepository
 */

/**
 * @typedef {{
 *   createShadowRun(run: import("./types.ts").ShadowRun): Promise<import("./types.ts").ShadowRun>,
 *   updateShadowRunStatus(runId: string, patch: Partial<import("./types.ts").ShadowRun>): Promise<import("./types.ts").ShadowRun>,
 *   createShadowResult(result: import("./types.ts").ShadowResult): Promise<import("./types.ts").ShadowResult>,
 *   createShadowDiff(diff: import("./types.ts").ShadowDiff): Promise<import("./types.ts").ShadowDiff>,
 *   createShadowExplanations(explanations: Record<string, unknown>[]): Promise<Record<string, unknown>[]>,
 *   getShadowHistoryByLead(leadId: string): Promise<Array<{ run: import("./types.ts").ShadowRun | null, result: import("./types.ts").ShadowResult, diff: import("./types.ts").ShadowDiff | null }>>,
 *   getLatestShadowResultByLead(leadId: string): Promise<import("./types.ts").ShadowResult | null>
 * }} ShadowRepository
 */

/**
 * @typedef {{
 *   createReviewItem(item: import("./types.ts").ReviewQueueItem): Promise<import("./types.ts").ReviewQueueItem>,
 *   listReviewQueue(filters?: import("./types.ts").ReviewQueueFilters): Promise<import("./types.ts").ReviewQueueItem[]>,
 *   getReviewItem(id: string): Promise<import("./types.ts").ReviewQueueItem | null>,
 *   updateReviewDecision(id: string, decision: import("./types.ts").ReviewDecisionPatch): Promise<import("./types.ts").ReviewQueueItem>,
 *   getReviewHistoryByLead(leadId: string): Promise<import("./types.ts").ReviewQueueItem[]>
 * }} ReviewRepository
 */

module.exports = {};
