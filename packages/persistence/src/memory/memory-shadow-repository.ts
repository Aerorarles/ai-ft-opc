// @ts-check

class MemoryShadowRepository {
  /** @type {Map<string, import("../types.ts").ShadowRun>} */
  runs = new Map();
  /** @type {Map<string, import("../types.ts").ShadowResult>} */
  results = new Map();
  /** @type {Map<string, import("../types.ts").ShadowDiff>} */
  diffs = new Map();
  /** @type {Map<string, import("../types.ts").ShadowExplanation[]>} */
  explanationsByResult = new Map();
  /** @type {Map<string, string>} */
  idempotencyIndex = new Map();

  async createShadowRun(run) {
    this.runs.set(run.shadow_run_id, run);
    this.idempotencyIndex.set(`${run.tenant_id}:${run.idempotency_key}`, run.shadow_run_id);
    return run;
  }

  /** @param {string} tenantId @param {string} idempotencyKey */
  async getShadowRunByIdempotencyKey(tenantId, idempotencyKey) {
    const runId = this.idempotencyIndex.get(`${tenantId}:${idempotencyKey}`);
    return runId ? this.runs.get(runId) || null : null;
  }

  async updateShadowRunStatus(runId, patch) {
    const existing = this.runs.get(runId);
    if (!existing) throw new Error(`shadow_run_not_found:${runId}`);
    const updated = { ...existing, ...patch };
    this.runs.set(runId, updated);
    return updated;
  }

  async createShadowResult(result) {
    this.results.set(result.shadow_result_id, result);
    return result;
  }

  async createShadowDiff(diff) {
    this.diffs.set(diff.shadow_diff_id, diff);
    return diff;
  }

  async createShadowExplanations(explanations) {
    for (const explanation of explanations) {
      const current = this.explanationsByResult.get(explanation.shadow_result_id) || [];
      current.push(explanation);
      this.explanationsByResult.set(explanation.shadow_result_id, current);
    }
    return explanations;
  }

  /** @param {string} resultId */
  async getShadowExplanationsByResult(resultId) {
    return [...(this.explanationsByResult.get(resultId) || [])];
  }

  async getShadowHistoryByLead(leadId) {
    const results = Array.from(this.results.values()).filter((item) => item.lead_id === leadId);
    return results.map((result) => ({
      run: this.runs.get(result.shadow_run_id) || null,
      result,
      diff: Array.from(this.diffs.values()).find((diff) => diff.shadow_result_id === result.shadow_result_id) || null,
    }));
  }

  async getLatestShadowResultByLead(leadId) {
    const history = await this.getShadowHistoryByLead(leadId);
    const latest = history.sort((a, b) => String(b.result.created_at).localeCompare(String(a.result.created_at)))[0];
    return latest ? latest.result : null;
  }
}

module.exports = { MemoryShadowRepository };
