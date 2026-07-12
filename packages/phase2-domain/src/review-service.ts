// @ts-check

const crypto = require("node:crypto");
const { validateReviewPersistenceEnvelope } = require("../../persistence/src/production-persistence-contract.ts");
const { validateIdempotencyReplayEnvelope } = require("../../persistence/src/idempotency-replay-safety.ts");

/** @param {string} prefix */
function createId(prefix) {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex")}`;
}

/**
 * Only persist a non-reversible note summary. Human note text is not part of
 * the local persistence contract or the future audit payload.
 *
 * @param {string | undefined} value
 * @returns {string | null}
 */
function summarizeReviewNote(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text ? `note_present(length=${Math.min(text.length, 240)})` : null;
}

/**
 * @param {import("../../persistence/src/repositories.ts").ReviewRepository} reviewRepository
 * @param {import("./types.ts").ReviewQueueItem} item
 */
async function createReviewItem(reviewRepository, item) {
  return reviewRepository.createReviewItem(item);
}

/**
 * @param {import("../../persistence/src/repositories.ts").ReviewRepository} reviewRepository
 * @param {string} id
 * @param {"approved" | "rejected" | "skipped"} status
 * @param {string=} note
 */
async function updateReviewStatus(reviewRepository, id, status, note = "") {
  return reviewRepository.updateReviewDecision(id, {
    review_status: status,
    review_notes: note,
  });
}

/**
 * Record one terminal review decision and update the current review item in
 * the same local-memory operation. This function never promotes a lead.
 *
 * @param {{
 *   reviewRepository: import("../../persistence/src/repositories.ts").ReviewRepository,
 *   review_item_id: string,
 *   review_status: "approved" | "rejected" | "skipped",
 *   reviewer_id: string,
 *   request_trace_id: string,
 *   idempotency_key: string,
 *   review_note?: string
 * }} input
 */
async function recordReviewDecision(input) {
  const item = await input.reviewRepository.getReviewItem(input.review_item_id);
  if (!item) throw new Error(`review_item_not_found:${input.review_item_id}`);
  const idempotencyValidation = validateIdempotencyReplayEnvelope({
    tenant_id: item.tenant_id || "local",
    request_trace_id: input.request_trace_id,
    idempotency_key: input.idempotency_key,
    operation: "review_action",
    replay_behavior: "reuse_existing",
  });
  if (!idempotencyValidation.valid) throw new Error(`idempotency_contract_invalid:${idempotencyValidation.errors.join(",")}`);
  const now = new Date().toISOString();
  const decision = {
    review_decision_id: createId("review-decision"),
    review_item_id: item.review_item_id,
    lead_id: item.lead_id,
    shadow_result_id: item.shadow_result_id,
    tenant_id: item.tenant_id || "local",
    decision: input.review_status,
    decision_notes_summary: summarizeReviewNote(input.review_note),
    decided_by: input.reviewer_id,
    request_trace_id: input.request_trace_id,
    idempotency_key: input.idempotency_key,
    decided_at: now,
  };
  const validation = validateReviewPersistenceEnvelope({
    scope: {
      tenant_id: decision.tenant_id,
      organization_id: item.organization_id || null,
      actor_user_id: item.actor_user_id || null,
      request_trace_id: input.request_trace_id,
      idempotency_key: input.idempotency_key,
    },
    review_item: {
      review_item_id: item.review_item_id,
      lead_id: item.lead_id,
      shadow_result_id: item.shadow_result_id,
      review_status: input.review_status,
    },
    decision,
  });
  if (!validation.valid) throw new Error(`review_contract_invalid:${validation.errors.join(",")}`);
  return input.reviewRepository.recordReviewDecision(item.review_item_id, decision);
}

module.exports = {
  createReviewItem,
  updateReviewStatus,
  recordReviewDecision,
  summarizeReviewNote,
};
