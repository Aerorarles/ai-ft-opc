// @ts-check

class MemoryReviewRepository {
  /** @type {Map<string, import("../types.ts").ReviewQueueItem>} */
  items = new Map();

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
    const updated = {
      ...item,
      review_status: decision.review_status,
      review_notes: decision.review_notes || item.review_notes,
      reviewed_at: now,
      updated_at: now,
    };
    this.items.set(id, updated);
    return updated;
  }

  async getReviewHistoryByLead(leadId) {
    return Array.from(this.items.values()).filter((item) => item.lead_id === leadId);
  }
}

module.exports = { MemoryReviewRepository };
