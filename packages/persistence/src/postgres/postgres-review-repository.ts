// @ts-check

const { assertPostgresShadowWriteAllowed } = require("../guards.ts");

class PostgresReviewRepository {
  /** @type {{ query(sql: string, params?: unknown[]): Promise<{ rows: any[] }> }} */
  client;
  /** @type {{ appStorageMode?: string, shadowWriterEnabled?: boolean, executionToken?: string | null }} */
  guardOptions;

  constructor(client, guardOptions = {}) {
    if (!client || typeof client.query !== "function") {
      throw new Error("PostgresReviewRepository requires an injected client.");
    }
    this.client = client;
    this.guardOptions = guardOptions;
  }

  guard() {
    assertPostgresShadowWriteAllowed(this.guardOptions);
  }

  async createReviewItem(item) {
    this.guard();
    const result = await this.client.query("/* insert lead_review_queue placeholder */", [item]);
    return result.rows[0] || item;
  }

  async listReviewQueue(filters: { status?: string } = {}) {
    const criteria = filters || {};
    const result = await this.client.query("/* readonly review queue placeholder */", [criteria.status || null]);
    return result.rows;
  }

  async getReviewItem(id) {
    const result = await this.client.query("/* readonly review item placeholder */", [id]);
    return result.rows[0] || null;
  }

  async updateReviewDecision(id, decision) {
    this.guard();
    const result = await this.client.query("/* update lead_review_queue placeholder */", [id, decision]);
    return result.rows[0];
  }

  async getReviewHistoryByLead(leadId) {
    const result = await this.client.query("/* readonly review history placeholder */", [leadId]);
    return result.rows;
  }
}

module.exports = { PostgresReviewRepository };
