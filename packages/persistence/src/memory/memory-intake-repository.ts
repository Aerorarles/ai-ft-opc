// @ts-check

class MemoryIntakeRepository {
  /** @type {Map<string, import("../types.ts").IntakeRun>} */
  runs = new Map();
  /** @type {Map<string, import("../types.ts").IntakeSourceItem>} */
  sourceItems = new Map();
  /** @type {Map<string, import("../types.ts").IntakeCandidateRecord>} */
  candidates = new Map();
  /** @type {Map<string, string>} */
  idempotencyIndex = new Map();

  /** @param {import("../types.ts").IntakeRun} run */
  async createIntakeRun(run) {
    this.runs.set(run.intake_run_id, run);
    this.idempotencyIndex.set(`${run.tenant_id}:${run.idempotency_key}`, run.intake_run_id);
    return run;
  }

  /** @param {string} runId */
  async getIntakeRun(runId) {
    return this.runs.get(runId) || null;
  }

  /** @param {string} tenantId @param {string} idempotencyKey */
  async getIntakeRunByIdempotencyKey(tenantId, idempotencyKey) {
    const runId = this.idempotencyIndex.get(`${tenantId}:${idempotencyKey}`);
    return runId ? this.runs.get(runId) || null : null;
  }

  /**
   * @param {string} runId
   * @param {Pick<import("../types.ts").IntakeRun, "source_item_count" | "candidate_count" | "run_status" | "completed_at">} patch
   */
  async completeIntakeRun(runId, patch) {
    const current = this.runs.get(runId);
    if (!current) throw new Error(`intake_run_not_found:${runId}`);
    const updated = { ...current, ...patch };
    this.runs.set(runId, updated);
    return updated;
  }

  /** @param {import("../types.ts").IntakeSourceItem} item */
  async createSourceItem(item) {
    this.sourceItems.set(item.source_item_id, item);
    return item;
  }

  /** @param {import("../types.ts").IntakeCandidateRecord} candidate */
  async createCandidate(candidate) {
    this.candidates.set(candidate.candidate_id, candidate);
    return candidate;
  }

  /** @param {string} runId */
  async listCandidatesByRun(runId) {
    return Array.from(this.candidates.values()).filter((candidate) => candidate.intake_run_id === runId);
  }
}

module.exports = { MemoryIntakeRepository };
