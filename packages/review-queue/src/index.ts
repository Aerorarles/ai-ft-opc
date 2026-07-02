// @ts-check

/**
 * @typedef {{
 *   id: string,
 *   lead: Record<string, unknown>,
 *   decision: Record<string, unknown>,
 *   status: "pending" | "approved" | "rejected",
 *   created_at: string,
 *   reviewed_at: string | null,
 *   review_note: string | null
 * }} ReviewQueueItem
 */

class ReviewQueue {
  /** @type {Map<string, ReviewQueueItem>} */
  items;

  constructor() {
    this.items = new Map();
  }

  /**
   * @param {Record<string, unknown>} lead
   * @param {Record<string, unknown>} decision
   * @returns {ReviewQueueItem}
   */
  addToQueue(lead, decision) {
    const id = `review-${this.items.size + 1}`;
    const item = {
      id,
      lead,
      decision,
      status: "pending",
      created_at: new Date().toISOString(),
      reviewed_at: null,
      review_note: null,
    };
    this.items.set(id, item);
    return item;
  }

  /**
   * @param {string} id
   * @param {string=} note
   * @returns {ReviewQueueItem}
   */
  approveLead(id, note = "") {
    return this.transition(id, "approved", note);
  }

  /**
   * @param {string} id
   * @param {string=} note
   * @returns {ReviewQueueItem}
   */
  rejectLead(id, note = "") {
    return this.transition(id, "rejected", note);
  }

  /**
   * @param {string} id
   * @param {"approved" | "rejected"} status
   * @param {string} note
   * @returns {ReviewQueueItem}
   */
  transition(id, status, note) {
    const item = this.items.get(id);
    if (!item) {
      throw new Error(`review_item_not_found:${id}`);
    }
    if (item.status !== "pending") {
      throw new Error(`review_item_already_closed:${id}`);
    }
    item.status = status;
    item.reviewed_at = new Date().toISOString();
    item.review_note = note || null;
    return item;
  }

  /**
   * @returns {ReviewQueueItem[]}
   */
  list() {
    return Array.from(this.items.values());
  }
}

module.exports = {
  ReviewQueue,
};
