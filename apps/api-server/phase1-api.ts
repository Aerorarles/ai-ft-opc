// @ts-check

const { normalizeLead } = require("../../packages/ingestion/src/index.ts");
const { isDuplicate } = require("../../packages/dedup/src/index.ts");
const { decideLeadAction } = require("../../packages/decision/src/index.ts");
const { ReviewQueue } = require("../../packages/review-queue/src/index.ts");
const { scoreLeadAPI } = require("../../scoring-engine/src/api/scoring-service.ts");

/**
 * @typedef {{
 *   id: string,
 *   normalized: import("../../packages/ingestion/src/index.ts").LeadNormalized,
 *   v1_score: number,
 *   v2_shadow_score: number | null,
 *   scoring: Record<string, unknown>,
 *   decision: import("../../packages/decision/src/index.ts").LeadDecision,
 *   review_item_id: string | null,
 *   duplicate_of: string | null
 * }} Phase1LeadRecord
 */

class Phase1Store {
  /** @type {Map<string, Phase1LeadRecord>} */
  leads;

  /** @type {ReviewQueue} */
  reviewQueue;

  constructor() {
    this.leads = new Map();
    this.reviewQueue = new ReviewQueue();
  }
}

/**
 * @param {import("../../packages/ingestion/src/index.ts").LeadNormalized} lead
 * @returns {number}
 */
function resolveLegacyV01Score(lead) {
  return Number.isFinite(lead.legacy_v01_score) ? lead.legacy_v01_score : 0;
}

/**
 * @param {import("../../packages/ingestion/src/index.ts").LeadNormalized} lead
 * @returns {ReturnType<typeof scoreLeadAPI>}
 */
function scoreShadowLead(lead) {
  return scoreLeadAPI({
    lead: {
      company_name: lead.company_name,
      website: lead.website || undefined,
      country: lead.country || undefined,
      industry: lead.industry || undefined,
      email: lead.email || undefined,
      phone: lead.phone || undefined,
      notes: lead.notes || undefined,
      signals: lead.signals,
    },
    tenant_id: "local",
    config_version_id: "v1",
    run_mode: "preview",
    request_trace_id: `phase1:${lead.id}`,
    idempotency_key: `phase1:${lead.id}`,
  });
}

/**
 * @param {Phase1Store} store
 * @param {Record<string, unknown>} input
 * @returns {{ record: Phase1LeadRecord, duplicate: boolean, duplicate_of: string | null }}
 */
function ingestLead(store, input) {
  const normalized = normalizeLead(input);
  for (const existing of store.leads.values()) {
    const dedup = isDuplicate(normalized, existing.normalized);
    if (dedup.duplicate) {
      const duplicateRecord = {
        id: normalized.id,
        normalized,
        v1_score: resolveLegacyV01Score(normalized),
        v2_shadow_score: null,
        scoring: {},
        decision: {
          action: "COLD",
          confidence: dedup.confidence,
          reasons: [`duplicate:${dedup.reason}`],
          risk_flags: ["duplicate"],
          next_step: "Do not create a new review item.",
        },
        review_item_id: null,
        duplicate_of: existing.id,
      };
      return { record: duplicateRecord, duplicate: true, duplicate_of: existing.id };
    }
  }

  const scoring = scoreShadowLead(normalized);
  const v1Score = resolveLegacyV01Score(normalized);
  const decision = decideLeadAction(v1Score, scoring.total_score, normalized);
  const record = {
    id: normalized.id,
    normalized,
    v1_score: v1Score,
    v2_shadow_score: scoring.total_score,
    scoring: {
      execution_id: scoring.execution_id,
      total_score: scoring.total_score,
      breakdown: scoring.breakdown,
      applied_rule_count: scoring.applied_rules.length,
      replay_consistency: scoring.replay_metadata.is_consistent === true,
      inconsistency_type: scoring.replay_metadata.inconsistency_type,
    },
    decision,
    review_item_id: null,
    duplicate_of: null,
  };
  const reviewItem = store.reviewQueue.addToQueue({
    id: record.id,
    company_name: normalized.company_name,
    domain: normalized.domain,
    country: normalized.country,
    industry: normalized.industry,
  }, decision);
  record.review_item_id = reviewItem.id;
  store.leads.set(record.id, record);
  return { record, duplicate: false, duplicate_of: null };
}

/**
 * @param {Phase1Store} store
 * @param {Record<string, unknown>[]} inputs
 */
function runPhase1Pipeline(store, inputs) {
  const processed = [];
  let duplicatesRemoved = 0;
  for (const input of inputs) {
    const result = ingestLead(store, input);
    processed.push(result);
    if (result.duplicate) duplicatesRemoved += 1;
  }
  const distribution = { HOT: 0, WARM: 0, COLD: 0 };
  for (const record of store.leads.values()) {
    distribution[record.decision.action] += 1;
  }
  return {
    total_leads_processed: inputs.length,
    duplicates_removed: duplicatesRemoved,
    distribution,
    processed,
    review_queue: store.reviewQueue.list(),
  };
}

/**
 * @param {Phase1Store=} existingStore
 */
function createPhase1Api(existingStore) {
  const store = existingStore || new Phase1Store();

  /**
   * @param {string} method
   * @param {string} path
   * @param {Record<string, unknown>=} body
   */
  async function request(method, path, body = {}) {
    const payload: Record<string, any> = body || {};
    const upper = method.toUpperCase();
    if (upper === "POST" && path === "/lead/ingest") {
      const result = ingestLead(store, payload);
      return { status: result.duplicate ? 200 : 201, json: result };
    }
    if (upper === "GET" && path.startsWith("/lead/")) {
      const id = path.split("/")[2];
      const lead = store.leads.get(id);
      return lead ? { status: 200, json: lead } : { status: 404, json: { error: "lead_not_found" } };
    }
    if (upper === "POST" && path === "/lead/decide") {
      const leadId = String(payload.lead_id || "");
      const lead = store.leads.get(leadId);
      if (!lead) return { status: 404, json: { error: "lead_not_found" } };
      lead.decision = decideLeadAction(lead.v1_score, lead.v2_shadow_score, lead.normalized);
      return { status: 200, json: lead.decision };
    }
    if (upper === "POST" && path === "/lead/review") {
      const reviewId = String(payload.review_item_id || "");
      const action = String(payload.action || "");
      const note = String(payload.note || "");
      const item = action === "approve"
        ? store.reviewQueue.approveLead(reviewId, note)
        : store.reviewQueue.rejectLead(reviewId, note);
      return { status: 200, json: item };
    }
    if (upper === "GET" && path === "/leads") {
      return { status: 200, json: Array.from(store.leads.values()) };
    }
    return { status: 404, json: { error: "not_found" } };
  }

  return { store, request };
}

module.exports = {
  Phase1Store,
  createPhase1Api,
  ingestLead,
  runPhase1Pipeline,
  scoreShadowLead,
  resolveLegacyV01Score,
};
