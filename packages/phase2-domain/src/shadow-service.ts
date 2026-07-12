// @ts-check

const { scoreLeadAPI } = require("../../../scoring-engine/src/api/scoring-service.ts");
const { decidePhase2Lead } = require("./decision-service.ts");
const { validateShadowPersistenceEnvelope } = require("../../persistence/src/production-persistence-contract.ts");
const { buildIdempotencyKey, validateIdempotencyReplayEnvelope } = require("../../persistence/src/idempotency-replay-safety.ts");

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
 * Keep explanation values descriptive but non-reversible. Rule values are
 * execution inputs, not persisted shadow explanation payloads.
 *
 * @param {unknown} value
 * @returns {string}
 */
function summarizeConfiguredValue(value) {
  if (value === null || value === undefined) return "not_applicable";
  if (Array.isArray(value)) return `configured_list(count=${value.length})`;
  if (typeof value === "boolean") return `configured_boolean(${value})`;
  return "configured_scalar";
}

/**
 * @param {string} shadowResultId
 * @param {import("../../../scoring-engine/src/types.ts").AppliedRule[]} appliedRules
 * @param {string} createdAt
 * @returns {import("./types.ts").ShadowExplanation[]}
 */
function toShadowExplanations(shadowResultId, appliedRules, createdAt) {
  return appliedRules.map((rule, index) => ({
    shadow_explanation_id: `${shadowResultId}:rule:${index}`,
    shadow_result_id: shadowResultId,
    rule_id: rule.rule_id,
    rule_type: rule.rule_type || null,
    field: rule.field || null,
    operator: rule.operator || null,
    dimension: rule.dimension || null,
    raw_delta: typeof rule.raw_delta === "number" ? rule.raw_delta : null,
    weight: typeof rule.weight === "number" ? rule.weight : null,
    effective_delta: typeof rule.effective_delta === "number" ? rule.effective_delta : null,
    expected_value_summary: summarizeConfiguredValue(rule.expected_value),
    actual_value_summary: String(rule.actual_value_summary || "not_available").slice(0, 120),
    created_at: createdAt,
  }));
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
 *   tenant_id?: string,
 *   organization_id?: string | null,
 *   actor_user_id?: string | null,
 *   idempotency_key?: string,
 *   force_invalid_config?: boolean,
 *   force_replay_inconsistency?: boolean
 * }} input
 */
async function runSingleLeadShadow(input) {
  const lead = input.leadSnapshot || await input.leadRepository.getLeadSnapshot(input.lead_id);
  if (!lead) throw new Error(`lead_snapshot_not_found:${input.lead_id}`);
  const tenantId = input.tenant_id || "local";
  const idempotencyKey = input.idempotency_key || buildIdempotencyKey({ operation: "shadow_run", request_trace_id: input.request_trace_id, entity_id: lead.id });
  const idempotencyValidation = validateIdempotencyReplayEnvelope({
    tenant_id: tenantId,
    request_trace_id: input.request_trace_id,
    idempotency_key: idempotencyKey,
    operation: "shadow_run",
    replay_behavior: "reuse_existing",
  });
  if (!idempotencyValidation.valid) throw new Error(`idempotency_contract_invalid:${idempotencyValidation.errors.join(",")}`);
  const existingRun = input.allow_shadow_write
    ? await input.shadowRepository.getShadowRunByIdempotencyKey(tenantId, idempotencyKey)
    : null;
  if (existingRun) {
    const history = await input.shadowRepository.getShadowHistoryByLead(lead.id);
    const existing = history.find((item) => item.run && item.run.shadow_run_id === existingRun.shadow_run_id) || null;
    return {
      mode: "memory_shadow_reused",
      reused: true,
      lead,
      run: existingRun,
      result: existing ? existing.result : null,
      diff: existing ? existing.diff : null,
      decision: null,
      review_item: null,
      explanations: existing ? await input.shadowRepository.getShadowExplanationsByResult(existing.result.shadow_result_id) : [],
    };
  }
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
  const engineVersion = blocked ? "0.6" : String(scoring.replay_metadata.engine_version || "0.6");
  const outcomePolicyId = blocked ? "not-configured" : String(scoring.replay_metadata.outcome_policy_id || "not-configured");
  const outcomePolicyVersion = blocked ? "not-configured" : String(scoring.replay_metadata.outcome_policy_version || "not-configured");
  const outcomePolicyChecksum = blocked ? "not-configured" : String(scoring.replay_metadata.outcome_policy_checksum || "not-configured");
  const scoreDelta = typeof shadowScore === "number" ? shadowScore - lead.v01_score : null;
  const requiresReview = blocked || replayConsistency === false || (scoreDelta !== null && Math.abs(scoreDelta) >= 15);
  const decision = decidePhase2Lead(lead, shadowScore, { replayConsistency, blocked });

  const run = {
    shadow_run_id: shadowRunId,
    run_mode: "shadow",
    tenant_id: tenantId,
    organization_id: input.organization_id || null,
    actor_user_id: input.actor_user_id || null,
    trigger_source: input.trigger_source,
    request_trace_id: input.request_trace_id,
    idempotency_key: idempotencyKey,
    config_version: input.config_version,
    config_version_id: input.config_version,
    config_checksum: configChecksum,
    engine_version: engineVersion,
    outcome_policy_id: outcomePolicyId,
    outcome_policy_version: outcomePolicyVersion,
    outcome_policy_checksum: outcomePolicyChecksum,
    run_status: blocked ? "blocked" : "succeeded",
    lead_count: 1,
    started_at: now,
    completed_at: now,
    error_code: blocked ? "invalid_config_blocked" : null,
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
    config_version_id: input.config_version,
    config_checksum: configChecksum,
    engine_version: engineVersion,
    outcome_policy_id: outcomePolicyId,
    outcome_policy_version: outcomePolicyVersion,
    outcome_policy_checksum: outcomePolicyChecksum,
    replay_consistency: replayConsistency,
    inconsistency_type: inconsistencyType,
    input_summary: blocked ? { blocked: true } : scoring.explanation.input_summary,
    validation_status: blocked ? "invalid" : "valid",
    validation_errors_summary: blocked ? ["invalid_config_blocked"] : [],
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
  const explanations = blocked ? [] : toShadowExplanations(shadowResultId, scoring.applied_rules, now);
  const persistenceValidation = validateShadowPersistenceEnvelope({
    scope: {
      tenant_id: tenantId,
      organization_id: input.organization_id || null,
      actor_user_id: input.actor_user_id || null,
      request_trace_id: input.request_trace_id,
      idempotency_key: idempotencyKey,
    },
    version_anchors: {
      config_version_id: input.config_version,
      config_checksum: configChecksum,
      engine_version: engineVersion,
      outcome_policy_id: outcomePolicyId,
      outcome_policy_version: outcomePolicyVersion,
      outcome_policy_checksum: outcomePolicyChecksum,
    },
    run_mode: "shadow",
    input_summary: result.input_summary,
    result_summary: {
      total_score: result.shadow_score,
      applied_rule_count: result.applied_rule_count,
      replay_consistency: result.replay_consistency,
      inconsistency_type: result.inconsistency_type,
      validation_status: result.validation_status,
    },
    diff_summary: diff.diff_summary,
    explanations,
  });
  if (!persistenceValidation.valid) {
    throw new Error(`shadow_contract_invalid:${persistenceValidation.errors.join(",")}`);
  }
  const review = {
    review_item_id: reviewItemId,
    lead_id: lead.id,
    shadow_run_id: shadowRunId,
    shadow_result_id: shadowResultId,
    tenant_id: tenantId,
    organization_id: input.organization_id || null,
    actor_user_id: input.actor_user_id || null,
    request_trace_id: input.request_trace_id,
    idempotency_key: `review:${idempotencyKey}`,
    decision_action: decision.action,
    decision_confidence: decision.confidence,
    decision_reasons: decision.reasons,
    risk_flags: decision.risk_flags,
    recommended_next_step: decision.next_step,
    review_status: "pending",
    assigned_to: null,
    reviewed_by: null,
    review_notes: null,
    reviewed_at: null,
    created_at: now,
    updated_at: now,
  };

  if (input.allow_shadow_write) {
    await input.shadowRepository.createShadowRun(run);
    await input.shadowRepository.createShadowResult(result);
    await input.shadowRepository.createShadowDiff(diff);
    await input.shadowRepository.createShadowExplanations(explanations);
    await input.reviewRepository.createReviewItem(review);
  }

  return {
    mode: input.allow_shadow_write ? "memory_shadow_write" : "preview_only",
    reused: false,
    lead,
    run,
    result,
    diff,
    decision,
    review_item: input.allow_shadow_write ? review : null,
    explanations: input.allow_shadow_write ? explanations : [],
  };
}

module.exports = {
  runSingleLeadShadow,
  toScoringLead,
  toShadowExplanations,
};
