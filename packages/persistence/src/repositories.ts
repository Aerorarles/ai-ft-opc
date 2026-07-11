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

/**
 * @typedef {{
 *   createIntakeRun(run: import("./types.ts").IntakeRun): Promise<import("./types.ts").IntakeRun>,
 *   getIntakeRun(runId: string): Promise<import("./types.ts").IntakeRun | null>,
 *   getIntakeRunByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<import("./types.ts").IntakeRun | null>,
 *   completeIntakeRun(runId: string, patch: Pick<import("./types.ts").IntakeRun, "source_item_count" | "candidate_count" | "run_status" | "completed_at">): Promise<import("./types.ts").IntakeRun>,
 *   createSourceItem(item: import("./types.ts").IntakeSourceItem): Promise<import("./types.ts").IntakeSourceItem>,
 *   createCandidate(candidate: import("./types.ts").IntakeCandidateRecord): Promise<import("./types.ts").IntakeCandidateRecord>,
 *   listCandidatesByRun(runId: string): Promise<import("./types.ts").IntakeCandidateRecord[]>
 * }} IntakeRepository
 */

module.exports = {};
