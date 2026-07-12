// @ts-check

/** @param {string | undefined} value */
function summarizeLegacyReviewNote(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text ? `note_present(length=${Math.min(text.length, 240)})` : null;
}

class MemoryReviewRepository {
  /** @type {Map<string, import("../types.ts").ReviewQueueItem>} */
  items = new Map();
  /** @type {Map<string, import("../types.ts").ReviewDecision[]>} */
  decisionsByItem = new Map();
  /** @type {Map<string, import("../types.ts").ReviewDecision>} */
  decisionIdempotencyIndex = new Map();
  legacyDecisionSequence = 0;

  async createReviewItem(item) {
    this.items.set(item.review_item_id, item);
    return item;
  }

  async listReviewQueue(filters: { status?: string } = {}) {
    const criteria = filters || {};
    const values = Array.from(this.items.values());
    return criteria.status ? values.filter((item) => item.review_status === criteria.status) : values;
  }

  async getReviewItem(id) {
    return this.items.get(id) || null;
  }

  async updateReviewDecision(id, decision) {
    const item = this.items.get(id);
    if (!item) throw new Error(`review_item_not_found:${id}`);
    const now = new Date().toISOString();
    const result = await this.recordReviewDecision(id, {
      review_decision_id: `legacy-review-decision-${++this.legacyDecisionSequence}`,
      review_item_id: id,
      lead_id: item.lead_id,
      shadow_result_id: item.shadow_result_id,
      tenant_id: item.tenant_id || "local",
      decision: decision.review_status,
      decision_notes_summary: summarizeLegacyReviewNote(decision.review_notes),
      decided_by: decision.reviewed_by || "local-operator",
      request_trace_id: item.request_trace_id || `legacy:${id}`,
      idempotency_key: `legacy:${id}:${now}`,
      decided_at: now,
    });
    return result.item;
  }

  /**
   * @param {string} reviewItemId
   * @param {import("../types.ts").ReviewDecision} decision
   */
  async recordReviewDecision(reviewItemId, decision) {
    const item = this.items.get(reviewItemId);
    if (!item) throw new Error(`review_item_not_found:${reviewItemId}`);
    const key = `${decision.tenant_id}:${reviewItemId}:${decision.idempotency_key}`;
    const existing = this.decisionIdempotencyIndex.get(key);
    if (existing) return { item, decision: existing, reused: true };
    if (item.review_status !== "pending") throw new Error(`review_item_not_pending:${reviewItemId}`);

    const updated = {
      ...item,
      review_status: decision.decision,
      review_notes: decision.decision_notes_summary,
      reviewed_by: decision.decided_by,
      reviewed_at: decision.decided_at,
      updated_at: decision.decided_at,
    };
    const history = this.decisionsByItem.get(reviewItemId) || [];
    this.items.set(reviewItemId, updated);
    this.decisionsByItem.set(reviewItemId, [...history, decision]);
    this.decisionIdempotencyIndex.set(key, decision);
    return { item: updated, decision, reused: false };
  }

  /** @param {string} reviewItemId */
  async getReviewDecisionHistory(reviewItemId) {
    return [...(this.decisionsByItem.get(reviewItemId) || [])];
  }

  async getReviewHistoryByLead(leadId) {
    return Array.from(this.items.values()).filter((item) => item.lead_id === leadId);
  }
}

module.exports = { MemoryReviewRepository };
