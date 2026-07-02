// @ts-check

const { scoreLeadAPI } = require("../../../scoring-engine/src/api/scoring-service.ts");
const { decidePhase2Lead } = require("./decision-service.ts");

/**
 * @param {string} prefix
 * @returns {string}
 */
function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

/**
 * @param {import("./types.ts").ExistingLeadSnapshot} lead
 */
function toScoringLead(lead) {
  return {
    company_name: lead.company_name,
    website: lead.website_summary || undefined,
    country: lead.country || undefined,
    industry: lead.industry || undefined,
    email: lead.has_email ? "present@example.test" : undefined,
    phone: lead.has_phone ? "+1 000 000 0000" : undefined,
    signals: [
      lead.industry && /factory|manufacturing|display/i.test(lead.industry) ? "factory" : "",
      lead.industry && /display/i.test(lead.industry) ? "display" : "",
    ].filter(Boolean),
  };
}

/**
 * @param {{
 *   lead_id: string,
 *   leadSnapshot?: import("./types.ts").ExistingLeadSnapshot,
 *   leadRepository: import("../../persistence/src/repositories.ts").LeadRepository,
 *   shadowRepository: import("../../persistence/src/repositories.ts").ShadowRepository,
 *   reviewRepository: import("../../persistence/src/repositories.ts").ReviewRepository,
 *   config_version: string,
 *   request_trace_id: string,
 *   trigger_source: string,
 *   allow_shadow_write: boolean,
 *   force_invalid_config?: boolean,
 *   force_replay_inconsistency?: boolean
 * }} input
 */
async function runSingleLeadShadow(input) {
  const lead = input.leadSnapshot || await input.leadRepository.getLeadSnapshot(input.lead_id);
  if (!lead) throw new Error(`lead_snapshot_not_found:${input.lead_id}`);
  const now = new Date().toISOString();
  const shadowRunId = id("shadow-run");
  const shadowResultId = id("shadow-result");
  const shadowDiffId = id("shadow-diff");
  const reviewItemId = id("review");

  let scoring = null;
  let blocked = false;
  if (input.force_invalid_config) {
    blocked = true;
  } else {
    scoring = scoreLeadAPI({
      lead: toScoringLead(lead),
      tenant_id: "local",
      config_version_id: input.config_version,
      run_mode: "preview",
      request_trace_id: input.request_trace_id,
      idempotency_key: input.request_trace_id,
    });
  }

  const shadowScore = blocked ? null : scoring.total_score;
  const replayConsistency = blocked ? false : (input.force_replay_inconsistency ? false : scoring.replay_metadata.is_consistent === true);
  const inconsistencyType = blocked ? "CONFIG_MISMATCH" : (input.force_replay_inconsistency ? "RERUN_DIFFERENCE" : String(scoring.replay_metadata.inconsistency_type || "NONE"));
  const configChecksum = blocked ? "invalid-config" : String(scoring.replay_metadata.config_checksum || scoring.execution_id);
  const engineVersion = blocked ? "0.6" : "0.6";
  const scoreDelta = typeof shadowScore === "number" ? shadowScore - lead.v01_score : null;
  const requiresReview = blocked || replayConsistency === false || (scoreDelta !== null && Math.abs(scoreDelta) >= 15);
  const decision = decidePhase2Lead(lead, shadowScore, { replayConsistency, blocked });

  const run = {
    shadow_run_id: shadowRunId,
    run_mode: "shadow",
    trigger_source: input.trigger_source,
    request_trace_id: input.request_trace_id,
    config_version: input.config_version,
    config_checksum: configChecksum,
    engine_version: engineVersion,
    run_status: blocked ? "blocked" : "succeeded",
    lead_count: 1,
    started_at: now,
    completed_at: now,
    error_summary: blocked ? "invalid_config_blocked" : null,
    created_at: now,
  };
  const result = {
    shadow_result_id: shadowResultId,
    shadow_run_id: shadowRunId,
    lead_id: lead.id,
    shadow_score: shadowScore,
    breakdown_summary: blocked ? {} : scoring.breakdown,
    applied_rule_count: blocked ? 0 : scoring.applied_rules.length,
    config_version: input.config_version,
    config_checksum: configChecksum,
    engine_version: engineVersion,
    replay_consistency: replayConsistency,
    inconsistency_type: inconsistencyType,
    input_summary: blocked ? { blocked: true } : scoring.explanation.input_summary,
    created_at: now,
  };
  const diff = {
    shadow_diff_id: shadowDiffId,
    shadow_result_id: shadowResultId,
    lead_id: lead.id,
    v01_score: lead.v01_score,
    v01_grade: lead.v01_grade,
    v01_priority: lead.v01_priority,
    shadow_score: shadowScore,
    score_delta: scoreDelta,
    grade_diff_status: "not_evaluated",
    priority_diff_status: "not_evaluated",
    requires_review: requiresReview,
    diff_summary: { score_delta: scoreDelta, requires_review: requiresReview },
    created_at: now,
  };
  const review = {
    review_item_id: reviewItemId,
    lead_id: lead.id,
    shadow_result_id: shadowResultId,
    decision_action: decision.action,
    decision_confidence: decision.confidence,
    decision_reasons: decision.reasons,
    risk_flags: decision.risk_flags,
    recommended_next_step: decision.next_step,
    review_status: "pending",
    review_notes: null,
    reviewed_at: null,
    created_at: now,
    updated_at: now,
  };

  if (input.allow_shadow_write) {
    await input.shadowRepository.createShadowRun(run);
    await input.shadowRepository.createShadowResult(result);
    await input.shadowRepository.createShadowDiff(diff);
    await input.reviewRepository.createReviewItem(review);
  }

  return {
    mode: input.allow_shadow_write ? "memory_shadow_write" : "preview_only",
    lead,
    run,
    result,
    diff,
    decision,
    review_item: input.allow_shadow_write ? review : null,
  };
}

module.exports = {
  runSingleLeadShadow,
  toScoringLead,
};
