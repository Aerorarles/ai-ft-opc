// @ts-check

class MemoryShadowRepository {
  /** @type {Map<string, import("../types.ts").ShadowRun>} */
  runs = new Map();
  /** @type {Map<string, import("../types.ts").ShadowResult>} */
  results = new Map();
  /** @type {Map<string, import("../types.ts").ShadowDiff>} */
  diffs = new Map();
  /** @type {Record<string, unknown>[]} */
  explanations = [];

  async createShadowRun(run) {
    this.runs.set(run.shadow_run_id, run);
    return run;
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
    this.explanations.push(...explanations);
    return explanations;
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
