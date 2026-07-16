// @ts-check

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { scoreLeadAPI } = require("../../../../scoring-engine/src/api/scoring-service.ts");
const { validateShadowPersistenceEnvelope } = require("../production-persistence-contract.ts");
const {
  HISTORICAL_TECHNICAL_TEST_LEAD_IDS,
  computeCandidateEvidenceHash,
  computeInputSnapshotHash,
  validateShadowWriteRequest,
} = require("../shadow-write-request.ts");

/** @param {Buffer | string} value */
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function currentWriterPackageHash() {
  const packageFiles = [
    __filename,
    path.join(__dirname, "local-single-lead-shadow-client.ts"),
    path.resolve(__dirname, "../../../../scripts/shadow-write/execute-approved-single-lead.ts"),
    path.resolve(__dirname, "../../../../scripts/shadow-write/execute-approved-single-lead.ps1"),
  ];
  const content = packageFiles.map((file) => `${path.basename(file)}\n${fs.readFileSync(file, "utf8")}`).join("\n---\n");
  return sha256(content);
}

function currentConfigArtifactHash() {
  return sha256(fs.readFileSync(require.resolve("../../../../scoring-config/v1.json")));
}

/** @param {unknown} value */
function text(value) {
  return String(value === null || value === undefined ? "" : value).trim();
}

/** @param {unknown} value */
function bool(value) {
  return value === true || value === "t" || value === "true" || value === 1;
}

/** @param {string} value */
function sanitizeExplanation(value) {
  const compact = text(value).replace(/[\r\n]+/g, " ").slice(0, 120);
  if (!compact) return "not_available";
  if (/@/.test(compact) || /\+?\d[\d\s().-]{7,}\d/.test(compact)) return "sensitive_value_redacted";
  return compact;
}

/** @param {any} result @param {string} label */
function assertSingleRow(result, label) {
  const count = typeof result.rowCount === "number" ? result.rowCount : Array.isArray(result.rows) ? result.rows.length : 0;
  if (count !== 1) throw new Error(`row_limit_violation:${label}:${count}`);
  return result.rows[0];
}

/** @param {any} row */
function classifyLead(row) {
  const businessStatus = text(row.business_status).toLowerCase();
  const source = text(row.source).toLowerCase();
  const competitorFlag = businessStatus.includes("competitor");
  const testSampleFlag = HISTORICAL_TECHNICAL_TEST_LEAD_IDS.includes(text(row.lead_id).toLowerCase()) || /(test|demo|sample)/.test(source);
  const suppressionFlag = /(suppressed|do[_ -]?not[_ -]?contact)/.test(businessStatus);
  const rejectedFlag = businessStatus.includes("rejected");
  const hasMinimumInput = Boolean(
    text(row.company_name) &&
    (text(row.website) || text(row.country) || text(row.industry) || bool(row.has_email) || bool(row.has_phone))
  );
  return { competitorFlag, testSampleFlag, suppressionFlag, rejectedFlag, hasMinimumInput };
}

/** @param {any} row */
function candidateSummary(row) {
  const classification = classifyLead(row);
  return {
    lead_id: text(row.lead_id),
    company_name: text(row.company_name),
    v01_score: row.v01_score,
    v01_grade: row.v01_grade,
    v01_priority: row.v01_priority,
    enrichment_status: row.enrichment_status,
    business_status: row.business_status,
    competitor_flag: classification.competitorFlag,
    test_sample_flag: classification.testSampleFlag,
    suppression_flag: classification.suppressionFlag,
    recommendation: "eligible_for_shadow_review",
  };
}

/** @param {any} row */
function snapshotForHash(row) {
  return {
    lead_id: text(row.lead_id),
    company_name: text(row.company_name),
    website: text(row.website),
    country: text(row.country),
    industry: text(row.industry),
    has_email: bool(row.has_email),
    has_phone: bool(row.has_phone),
    v01_score: row.v01_score,
    v01_grade: row.v01_grade,
    v01_priority: row.v01_priority,
    business_status: row.business_status,
    enrichment_status: row.enrichment_status,
  };
}

/** @param {any} row */
function scoringLead(row) {
  const industry = text(row.industry);
  return {
    company_name: text(row.company_name),
    website: text(row.website) || undefined,
    country: text(row.country) || undefined,
    industry: industry || undefined,
    email: bool(row.has_email) ? "present@example.test" : undefined,
    phone: bool(row.has_phone) ? "+1 000 000 0000" : undefined,
    signals: [
      /factory|manufacturing|display/i.test(industry) ? "factory" : "",
      /display/i.test(industry) ? "display" : "",
    ].filter(Boolean),
  };
}

/**
 * Executes exactly one approved, no-review Shadow Write using an injected PostgreSQL client.
 * It never reads credentials, grants privileges, mutates public.leads, or creates Review Queue data.
 *
 * @param {{ query(sql: string, params?: unknown[]): Promise<{ rows: any[], rowCount?: number }> }} client
 * @param {unknown} approvedRequest
 */
async function executeApprovedSingleLeadShadowWrite(client, approvedRequest) {
  if (!client || typeof client.query !== "function") throw new Error("postgres_client_required");
  const validation = validateShadowWriteRequest(approvedRequest, { requireApproved: true });
  if (!validation.valid || !validation.request) throw new Error(`approval_scope_mismatch:${validation.errors.join(",")}`);
  const request = validation.request;
  if (request.writer.database_role !== "aiopc_shadow_writer_m1") throw new Error("writer_database_role_mismatch");
  if (request.writer.package_sha256 !== currentWriterPackageHash()) throw new Error("writer_package_hash_mismatch");
  if (request.versions.config_artifact_sha256 !== currentConfigArtifactHash()) throw new Error("config_artifact_hash_mismatch");

  let transactionStarted = false;
  let committed = false;
  try {
    await client.query("BEGIN");
    transactionStarted = true;
    const leadResult = await client.query(
      `/* shadow_writer:select_lead */
       SELECT id::text AS lead_id, company_name, website, country, industry,
              (NULLIF(btrim(COALESCE(email, '')), '') IS NOT NULL) AS has_email,
              (NULLIF(btrim(COALESCE(phone, '')), '') IS NOT NULL) AS has_phone,
              score AS v01_score, grade AS v01_grade, priority AS v01_priority,
              enrichment_status, status AS business_status, source
       FROM public.leads
       WHERE id = $1::uuid
       FOR SHARE`,
      [request.target.lead_id],
    );
    const lead = assertSingleRow(leadResult, "selected_lead");
    if (text(lead.company_name) !== request.target.company_name) throw new Error("candidate_company_name_changed");
    const classification = classifyLead(lead);
    if (classification.competitorFlag || classification.testSampleFlag || classification.suppressionFlag || classification.rejectedFlag) {
      throw new Error("candidate_no_longer_eligible");
    }
    if (!classification.hasMinimumInput) throw new Error("candidate_minimum_scoring_input_missing");
    if (computeCandidateEvidenceHash(candidateSummary(lead)) !== request.candidate_selection.evidence_hash) {
      throw new Error("candidate_evidence_hash_mismatch");
    }
    const inputSnapshotHash = computeInputSnapshotHash(snapshotForHash(lead));
    if (inputSnapshotHash !== request.candidate_selection.input_snapshot_hash) throw new Error("input_snapshot_hash_mismatch");

    const existingClaim = await client.query(
      `/* shadow_writer:check_idempotency */
       SELECT idempotency_claim_id, claim_status
       FROM public.lead_operation_idempotency_claims
       WHERE tenant_id = $1 AND operation_type = 'shadow_run' AND idempotency_key = $2`,
      [request.target.tenant_id, request.request.idempotency_key],
    );
    if (existingClaim.rows.length > 0) {
      if (existingClaim.rows[0].claim_status !== "completed") throw new Error("idempotency_claim_not_completed");
      await client.query("ROLLBACK");
      transactionStarted = false;
      return { reused: true, database_writes: 0, public_leads_changed: false, v01_facts_changed: false };
    }

    const scoring = scoreLeadAPI({
      lead: scoringLead(lead),
      tenant_id: request.target.tenant_id,
      config_version_id: request.versions.config_version,
      run_mode: "shadow",
      request_trace_id: request.request.trace_id,
      idempotency_key: request.request.idempotency_key,
    });
    if (text(scoring.replay_metadata.config_checksum).toLowerCase() !== request.versions.config_checksum) throw new Error("config_checksum_mismatch");
    if (text(scoring.replay_metadata.engine_version) !== request.versions.engine_version) throw new Error("engine_version_mismatch");
    if (text(scoring.replay_metadata.outcome_policy_id || "not-configured") !== request.versions.outcome_policy) throw new Error("outcome_policy_mismatch");
    if (scoring.applied_rules.length > request.scope.max_rows["public.lead_scoring_shadow_explanations"]) {
      throw new Error("row_limit_violation:explanations");
    }

    const now = new Date().toISOString();
    const ids = {
      claim: crypto.randomUUID(), run: crypto.randomUUID(), result: crypto.randomUUID(),
      diff: crypto.randomUUID(), audit: crypto.randomUUID(),
    };
    const scoreDelta = typeof scoring.total_score === "number" && typeof lead.v01_score === "number"
      ? scoring.total_score - lead.v01_score : null;
    const explanations = scoring.applied_rules.map((rule) => ({
      id: crypto.randomUUID(), rule_id: rule.rule_id, rule_type: rule.rule_type || null,
      field: rule.field || null, operator: rule.operator || null, dimension: rule.dimension || null,
      raw_delta: rule.raw_delta ?? null, weight: rule.weight ?? null,
      effective_delta: rule.effective_delta ?? null,
      expected_value_summary: Array.isArray(rule.expected_value) ? `configured_list(count=${rule.expected_value.length})` : "configured_value",
      actual_value_summary: sanitizeExplanation(rule.actual_value_summary),
    }));
    const persistedInputSummary = {
      ...scoring.explanation.input_summary,
      input_snapshot_hash: inputSnapshotHash,
      candidate_evidence_hash: request.candidate_selection.evidence_hash,
      scoring_execution_id: scoring.execution_id,
    };
    const persistenceValidation = validateShadowPersistenceEnvelope({
      scope: {
        tenant_id: request.target.tenant_id, organization_id: null, actor_user_id: null,
        request_trace_id: request.request.trace_id, idempotency_key: request.request.idempotency_key,
      },
      version_anchors: {
        config_version_id: request.versions.config_version,
        config_checksum: request.versions.config_checksum,
        engine_version: request.versions.engine_version,
        outcome_policy_id: "not-configured", outcome_policy_version: "not-configured",
        outcome_policy_checksum: "not-configured",
      },
      run_mode: "shadow",
      input_summary: persistedInputSummary,
      result_summary: { total_score: scoring.total_score, applied_rule_count: explanations.length },
      diff_summary: { score_delta: scoreDelta, requires_review: true },
      explanations,
    });
    if (!persistenceValidation.valid) throw new Error(`shadow_contract_invalid:${persistenceValidation.errors.join(",")}`);

    const rowCounts = {
      "public.lead_operation_idempotency_claims": 0,
      "public.lead_scoring_shadow_runs": 0,
      "public.lead_scoring_shadow_results": 0,
      "public.lead_scoring_shadow_diff": 0,
      "public.lead_scoring_shadow_explanations": 0,
      "public.lead_audit_events": 0,
    };
    assertSingleRow(await client.query(
      `/* shadow_writer:insert_idempotency */ INSERT INTO public.lead_operation_idempotency_claims
       (idempotency_claim_id, tenant_id, operation_type, idempotency_key, request_trace_id,
        entity_type, entity_id, request_fingerprint, claim_status, completed_at)
       VALUES ($1::uuid,$2,'shadow_run',$3,$4,'lead',$5,$6,'completed',$7::timestamptz)
       RETURNING idempotency_claim_id`,
      [ids.claim, request.target.tenant_id, request.request.idempotency_key, request.request.trace_id,
        request.target.lead_id, request.approval.approval_scope_hash, now],
    ), "idempotency_claim");
    rowCounts["public.lead_operation_idempotency_claims"] = 1;
    assertSingleRow(await client.query(
      `/* shadow_writer:insert_run */ INSERT INTO public.lead_scoring_shadow_runs
       (shadow_run_id, tenant_id, execution_id, request_trace_id, idempotency_key, run_mode,
        trigger_source, config_version, config_checksum, engine_version, outcome_policy_id,
        outcome_policy_version, outcome_policy_checksum, run_status, lead_count, started_at, completed_at)
       VALUES ($1::uuid,$2,$3,$4,$5,'shadow','manual',$6,$7,$8,'not-configured',
        'not-configured','not-configured','succeeded',1,$9::timestamptz,$9::timestamptz)
       RETURNING shadow_run_id`,
      [ids.run, request.target.tenant_id, request.request.id, request.request.trace_id,
        request.request.idempotency_key, request.versions.config_version, request.versions.config_checksum,
        request.versions.engine_version, now],
    ), "shadow_run");
    rowCounts["public.lead_scoring_shadow_runs"] = 1;
    assertSingleRow(await client.query(
      `/* shadow_writer:insert_result */ INSERT INTO public.lead_scoring_shadow_results
       (shadow_result_id, tenant_id, shadow_run_id, lead_id, execution_id, shadow_score,
        breakdown, applied_rule_count, config_version, config_checksum, engine_version,
        outcome_policy_id, outcome_policy_version, outcome_policy_checksum, replay_consistency,
        inconsistency_type, input_summary, validation_status, validation_errors_summary)
       VALUES ($1::uuid,$2,$3::uuid,$4::uuid,$5,$6,$7::jsonb,$8,$9,$10,$11,
        'not-configured','not-configured','not-configured',$12,$13,$14::jsonb,'valid','[]'::jsonb)
       RETURNING shadow_result_id`,
      [ids.result, request.target.tenant_id, ids.run, request.target.lead_id, request.request.id,
        scoring.total_score, JSON.stringify(scoring.breakdown), explanations.length,
        request.versions.config_version, request.versions.config_checksum, request.versions.engine_version,
        scoring.consistency_result && scoring.consistency_result.is_consistent === true,
        text(scoring.replay_metadata.inconsistency_type || "NONE"), JSON.stringify(persistedInputSummary)],
    ), "shadow_result");
    rowCounts["public.lead_scoring_shadow_results"] = 1;
    assertSingleRow(await client.query(
      `/* shadow_writer:insert_diff */ INSERT INTO public.lead_scoring_shadow_diff
       (shadow_diff_id, tenant_id, shadow_result_id, lead_id, v01_score, v01_grade,
        v01_priority, shadow_score, score_delta, grade_diff_status, priority_diff_status,
        requires_review, diff_summary)
       VALUES ($1::uuid,$2,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,'not_evaluated',
        'not_evaluated',true,$10::jsonb) RETURNING shadow_diff_id`,
      [ids.diff, request.target.tenant_id, ids.result, request.target.lead_id, lead.v01_score,
        lead.v01_grade, lead.v01_priority, scoring.total_score, scoreDelta,
        JSON.stringify({ score_delta: scoreDelta, requires_review: true })],
    ), "shadow_diff");
    rowCounts["public.lead_scoring_shadow_diff"] = 1;
    for (const explanation of explanations) {
      assertSingleRow(await client.query(
        `/* shadow_writer:insert_explanation */ INSERT INTO public.lead_scoring_shadow_explanations
         (shadow_explanation_id, tenant_id, shadow_result_id, rule_id, rule_type, field,
          operator, dimension, raw_delta, weight, effective_delta, expected_value_summary,
          actual_value_summary)
         VALUES ($1::uuid,$2,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING shadow_explanation_id`,
        [explanation.id, request.target.tenant_id, ids.result, explanation.rule_id,
          explanation.rule_type, explanation.field, explanation.operator, explanation.dimension,
          explanation.raw_delta, explanation.weight, explanation.effective_delta,
          explanation.expected_value_summary, explanation.actual_value_summary],
      ), "shadow_explanation");
      rowCounts["public.lead_scoring_shadow_explanations"] += 1;
    }
    assertSingleRow(await client.query(
      `/* shadow_writer:insert_audit */ INSERT INTO public.lead_audit_events
       (audit_event_id, tenant_id, request_trace_id, idempotency_key, event_type,
        entity_type, entity_id, shadow_run_id, shadow_result_id, payload_summary, sequence_index)
       VALUES ($1::uuid,$2,$3,$4,'shadow_persisted','lead',$5,$6::uuid,$7::uuid,$8::jsonb,0)
       RETURNING audit_event_id`,
      [ids.audit, request.target.tenant_id, request.request.trace_id, request.request.idempotency_key,
        request.target.lead_id, ids.run, ids.result, JSON.stringify({
          request_id: request.request.id, input_snapshot_hash: inputSnapshotHash,
          config_version: request.versions.config_version, engine_version: request.versions.engine_version,
          review_queue_created: false,
        })],
    ), "audit_event");
    rowCounts["public.lead_audit_events"] = 1;
    const totalRows = Object.values(rowCounts).reduce((sum, count) => sum + count, 0);
    if (totalRows > request.scope.total_max_rows) throw new Error(`row_limit_violation:total:${totalRows}`);

    const after = assertSingleRow(await client.query(
      `/* shadow_writer:verify_v01 */ SELECT score AS v01_score, grade AS v01_grade,
       priority AS v01_priority FROM public.leads WHERE id = $1::uuid`,
      [request.target.lead_id],
    ), "v01_verification");
    if (after.v01_score !== lead.v01_score || after.v01_grade !== lead.v01_grade || after.v01_priority !== lead.v01_priority) {
      throw new Error("v01_facts_changed");
    }
    await client.query("COMMIT");
    committed = true;
    return {
      reused: false, database_writes: totalRows, row_counts: rowCounts,
      request_id: request.request.id, trace_id: request.request.trace_id,
      tenant_id: request.target.tenant_id, lead_id: request.target.lead_id,
      shadow_run_id: ids.run, shadow_result_id: ids.result,
      public_leads_changed: false, v01_facts_changed: false, review_queue_created: false,
    };
  } catch (error) {
    if (transactionStarted && !committed) {
      try { await client.query("ROLLBACK"); } catch { /* Preserve the original failure. */ }
    }
    throw error;
  }
}

module.exports = {
  currentConfigArtifactHash,
  currentWriterPackageHash,
  executeApprovedSingleLeadShadowWrite,
};
