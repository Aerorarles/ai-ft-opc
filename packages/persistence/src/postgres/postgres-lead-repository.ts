// @ts-check

class PostgresLeadRepository {
  /** @type {{ query(sql: string, params?: unknown[]): Promise<{ rows: any[] }> }} */
  client;

  constructor(client) {
    if (!client || typeof client.query !== "function") {
      throw new Error("PostgresLeadRepository requires an injected client.");
    }
    this.client = client;
  }

  async getLeadSnapshot(leadId) {
    const result = await this.client.query("/* readonly snapshot query placeholder */", [leadId]);
    return result.rows[0] || null;
  }

  async listLeadSnapshots(query: { limit?: number } = {}) {
    const criteria = query || {};
    const result = await this.client.query("/* readonly snapshot list placeholder */", [criteria.limit || 50]);
    return result.rows;
  }

  async seedLeadSnapshot() {
    throw new Error("PostgreSQL lead seed is disabled. Use MemoryLeadRepository for local MVP tests.");
  }
}

module.exports = { PostgresLeadRepository };
