// @ts-check

const { runSingleLeadShadow } = require("../../packages/phase2-domain/src/index.ts");

function json(status, body) {
  return { status, json: { mode: "local_mvp", ...body } };
}

function sanitizeLead(lead) {
  return lead ? { ...lead } : null;
}

function createPhase2Api(repositories) {
  async function request(method: string, path: string, body: Record<string, any> = {}) {
    const upper = method.toUpperCase();
    const payload = body || {};
    if (upper === "GET" && path === "/api/health") {
      return json(200, { ok: true, storage: "memory", production_connected: false });
    }
    if (upper === "GET" && path === "/api/leads") {
      return json(200, { leads: (await repositories.leadRepository.listLeadSnapshots()).map(sanitizeLead) });
    }
    const leadMatch = path.match(/^\/api\/leads\/([^/]+)$/);
    if (upper === "GET" && leadMatch) {
      const lead = await repositories.leadRepository.getLeadSnapshot(leadMatch[1]);
      return lead ? json(200, { lead: sanitizeLead(lead) }) : json(404, { error: "lead_not_found" });
    }
    const historyMatch = path.match(/^\/api\/leads\/([^/]+)\/shadow-history$/);
    if (upper === "GET" && historyMatch) {
      const lead = await repositories.leadRepository.getLeadSnapshot(historyMatch[1]);
      if (!lead) return json(404, { error: "lead_not_found" });
      return json(200, { history: await repositories.shadowRepository.getShadowHistoryByLead(historyMatch[1]) });
    }
    if (upper === "GET" && path === "/api/review-queue") {
      return json(200, { items: await repositories.reviewRepository.listReviewQueue(payload) });
    }
    const reviewGetMatch = path.match(/^\/api\/review-queue\/([^/]+)$/);
    if (upper === "GET" && reviewGetMatch) {
      const item = await repositories.reviewRepository.getReviewItem(reviewGetMatch[1]);
      return item ? json(200, { item }) : json(404, { error: "review_item_not_found" });
    }
    if (upper === "POST" && path === "/api/shadow-runs/single-lead/preview") {
      const result = await runSingleLeadShadow({
        lead_id: String(payload.lead_id || ""),
        leadRepository: repositories.leadRepository,
        shadowRepository: repositories.shadowRepository,
        reviewRepository: repositories.reviewRepository,
        config_version: String(payload.config_version || "v1"),
        request_trace_id: String(payload.request_trace_id || `preview:${payload.lead_id || "missing"}`),
        trigger_source: "api",
        allow_shadow_write: payload.allow_shadow_write === true,
        force_invalid_config: payload.force_invalid_config === true,
        force_replay_inconsistency: payload.force_replay_inconsistency === true,
      });
      return json(200, { shadow: result });
    }
    const reviewAction = path.match(/^\/api\/review-queue\/([^/]+)\/(approve|reject|skip)$/);
    if (upper === "POST" && reviewAction) {
      const statusMap: Record<string, string> = { approve: "approved", reject: "rejected", skip: "skipped" };
      const item = await repositories.reviewRepository.updateReviewDecision(reviewAction[1], {
        review_status: statusMap[reviewAction[2]],
        review_notes: String(payload.note || ""),
      });
      return json(200, { item });
    }
    return json(404, { error: "not_found" });
  }
  return { request, repositories };
}

module.exports = {
  createPhase2Api,
};
