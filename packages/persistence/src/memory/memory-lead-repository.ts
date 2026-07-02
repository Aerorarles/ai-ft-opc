// @ts-check

class MemoryLeadRepository {
  /** @type {Map<string, import("../types.ts").ExistingLeadSnapshot>} */
  leads = new Map();

  async getLeadSnapshot(leadId) {
    return this.leads.get(leadId) || null;
  }

  async listLeadSnapshots(query: { limit?: number } = {}) {
    const criteria = query || {};
    const values = Array.from(this.leads.values());
    return typeof criteria.limit === "number" ? values.slice(0, criteria.limit) : values;
  }

  async seedLeadSnapshot(snapshot) {
    this.leads.set(snapshot.id, snapshot);
    return snapshot;
  }
}

module.exports = { MemoryLeadRepository };
