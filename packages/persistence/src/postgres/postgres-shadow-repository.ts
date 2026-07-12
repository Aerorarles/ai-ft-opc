// @ts-check

const { assertPostgresShadowWriteAllowed } = require("../guards.ts");

class PostgresShadowRepository {
  /** @type {{ query(sql: string, params?: unknown[]): Promise<{ rows: any[] }> }} */
  client;
  /** @type {{ appStorageMode?: string, shadowWriterEnabled?: boolean, executionToken?: string | null }} */
  guardOptions;

  constructor(client, guardOptions = {}) {
    if (!client || typeof client.query !== "function") {
      throw new Error("PostgresShadowRepository requires an injected client.");
    }
    this.client = client;
    this.guardOptions = guardOptions;
  }

  guard() {
    assertPostgresShadowWriteAllowed(this.guardOptions);
  }

  async createShadowRun(run) {
    this.guard();
    const result = await this.client.query("/* insert lead_scoring_shadow_runs placeholder */", [run]);
    return result.rows[0] || run;
  }

  async getShadowRunByIdempotencyKey(tenantId, idempotencyKey) {
    const result = await this.client.query("/* readonly shadow run idempotency placeholder */", [tenantId, idempotencyKey]);
    return result.rows[0] || null;
  }

  async updateShadowRunStatus(runId, patch) {
    this.guard();
    const result = await this.client.query("/* update lead_scoring_shadow_runs placeholder */", [runId, patch]);
    return result.rows[0];
  }

  async createShadowResult(resultInput) {
    this.guard();
    const result = await this.client.query("/* insert lead_scoring_shadow_results placeholder */", [resultInput]);
    return result.rows[0] || resultInput;
  }

  async createShadowDiff(diff) {
    this.guard();
    const result = await this.client.query("/* insert lead_scoring_shadow_diff placeholder */", [diff]);
    return result.rows[0] || diff;
  }

  async createShadowExplanations(explanations) {
    this.guard();
    await this.client.query("/* insert lead_scoring_shadow_explanations placeholder */", [explanations]);
    return explanations;
  }

  async getShadowExplanationsByResult(resultId) {
    const result = await this.client.query("/* readonly shadow explanations placeholder */", [resultId]);
    return result.rows;
  }

  async getShadowHistoryByLead(leadId) {
    const result = await this.client.query("/* readonly shadow history placeholder */", [leadId]);
    return result.rows;
  }

  async getLatestShadowResultByLead(leadId) {
    const result = await this.client.query("/* readonly latest shadow result placeholder */", [leadId]);
    return result.rows[0] || null;
  }
}

module.exports = { PostgresShadowRepository };
