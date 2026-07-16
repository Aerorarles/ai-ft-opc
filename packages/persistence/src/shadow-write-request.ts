// @ts-check

const crypto = require("node:crypto");
const yaml = require("js-yaml");
const { z } = require("zod");

const ALLOWED_SHADOW_TABLES = Object.freeze([
  "public.lead_operation_idempotency_claims",
  "public.lead_scoring_shadow_runs",
  "public.lead_scoring_shadow_results",
  "public.lead_scoring_shadow_diff",
  "public.lead_scoring_shadow_explanations",
  "public.lead_audit_events",
]);

const SHADOW_TABLE_ROW_LIMITS = Object.freeze({
  "public.lead_operation_idempotency_claims": 1,
  "public.lead_scoring_shadow_runs": 1,
  "public.lead_scoring_shadow_results": 1,
  "public.lead_scoring_shadow_diff": 1,
  "public.lead_scoring_shadow_explanations": 5,
  "public.lead_audit_events": 1,
});

const HISTORICAL_TECHNICAL_TEST_LEAD_IDS = Object.freeze([
  "18a32777-f886-4441-98d9-e2b06a5586ab",
  "eb5ca404-e70a-4c7f-8551-add018490cd5",
  "cdabf717-3c57-4586-befa-c5ee66953547",
]);

const sha256Pattern = /^[0-9a-f]{64}$/;
const isoTimestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)), "invalid ISO-8601 timestamp");

const RequestSchema = z.object({
  request: z.object({
    id: z.string().min(1),
    trace_id: z.string().uuid(),
    idempotency_key: z.string().regex(sha256Pattern),
    status: z.enum(["PENDING_APPROVAL", "APPROVED_FOR_SINGLE_WRITE", "EXECUTED", "VERIFIED", "BLOCKED"]),
    created_at: isoTimestamp,
    expires_at: isoTimestamp,
  }).strict(),
  candidate_selection: z.object({
    evidence_hash: z.string().regex(sha256Pattern),
    input_snapshot_hash: z.string().regex(sha256Pattern),
    selected_from_live_read: z.literal(true),
    exclusion_policy_version: z.literal("m1-shadow-candidate-v1"),
  }).strict(),
  target: z.object({
    tenant_id: z.literal("local"),
    lead_id: z.string().uuid(),
    company_name: z.string().min(1).max(300),
  }).strict(),
  versions: z.object({
    config_version: z.literal("v1"),
    config_artifact_sha256: z.string().regex(sha256Pattern),
    config_checksum: z.string().regex(sha256Pattern),
    engine_version: z.literal("0.6"),
    outcome_policy: z.literal("not-configured"),
  }).strict(),
  writer: z.object({
    package_sha256: z.string().regex(sha256Pattern),
    implementation: z.literal("single-lead-shadow-writer-v1"),
    database_role: z.literal("aiopc_shadow_writer_m1"),
  }).strict(),
  scope: z.object({
    max_entities: z.literal(1),
    transaction_required: z.literal(true),
    allowed_tables: z.array(z.string()).length(ALLOWED_SHADOW_TABLES.length),
    max_rows: z.object({
      "public.lead_operation_idempotency_claims": z.literal(1),
      "public.lead_scoring_shadow_runs": z.literal(1),
      "public.lead_scoring_shadow_results": z.literal(1),
      "public.lead_scoring_shadow_diff": z.literal(1),
      "public.lead_scoring_shadow_explanations": z.literal(5),
      "public.lead_audit_events": z.literal(1),
    }).strict(),
    total_max_rows: z.literal(10),
  }).strict(),
  prohibitions: z.object({
    modify_public_leads: z.literal(false),
    modify_v01_score_facts: z.literal(false),
    create_review_queue_data: z.literal(false),
    external_outreach: z.literal(false),
    execute_migration: z.literal(false),
    enable_writer: z.literal(false),
  }).strict(),
  approval: z.object({
    required: z.literal(true),
    approved_by: z.string().min(1).nullable(),
    approved_at: isoTimestamp.nullable(),
    approval_scope_hash: z.string().regex(sha256Pattern),
  }).strict(),
  rollback: z.object({
    owner: z.string().min(1),
    mode: z.literal("transaction_or_separate_approval"),
  }).strict(),
}).strict();

/** @param {string} value */
function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

/** @param {unknown} value */
function canonicalToken(value) {
  return String(value === null || value === undefined ? "" : value).trim().replace(/\|/g, "/");
}

/** @param {any} request */
function computeApprovalScopeHash(request) {
  const tableScope = [...ALLOWED_SHADOW_TABLES]
    .sort()
    .map((table) => `${table}:${SHADOW_TABLE_ROW_LIMITS[table]}`)
    .join(",");
  return sha256([
    request.request.id,
    request.target.tenant_id,
    request.target.lead_id,
    request.versions.config_version,
    request.versions.config_artifact_sha256,
    request.versions.config_checksum,
    request.versions.engine_version,
    request.versions.outcome_policy,
    request.candidate_selection.evidence_hash,
    request.candidate_selection.input_snapshot_hash,
    request.writer.package_sha256,
    request.writer.database_role,
    tableScope,
  ].map(canonicalToken).join("|"));
}

/**
 * @param {{
 * lead_id: unknown, company_name: unknown, v01_score: unknown, v01_grade: unknown,
 * v01_priority: unknown, enrichment_status: unknown, business_status: unknown,
 * competitor_flag: unknown, test_sample_flag: unknown, suppression_flag: unknown,
 * recommendation: unknown
 * }} summary
 */
function computeCandidateEvidenceHash(summary) {
  return sha256([
    summary.lead_id,
    summary.company_name,
    summary.v01_score,
    summary.v01_grade,
    summary.v01_priority,
    summary.enrichment_status,
    summary.business_status,
    String(summary.competitor_flag).toLowerCase(),
    String(summary.test_sample_flag).toLowerCase(),
    String(summary.suppression_flag).toLowerCase(),
    summary.recommendation,
  ].map(canonicalToken).join("|"));
}

/** @param {any} snapshot */
function computeInputSnapshotHash(snapshot) {
  return sha256([
    snapshot.lead_id || snapshot.id,
    snapshot.company_name,
    snapshot.website,
    snapshot.country,
    snapshot.industry,
    String(snapshot.has_email).toLowerCase(),
    String(snapshot.has_phone).toLowerCase(),
    snapshot.v01_score,
    snapshot.v01_grade,
    snapshot.v01_priority,
    snapshot.business_status || snapshot.status,
    snapshot.enrichment_status,
  ].map(canonicalToken).join("|"));
}

/**
 * @param {unknown} candidate
 * @param {{ requireApproved?: boolean, now?: Date }=} options
 */
function validateShadowWriteRequest(candidate, options) {
  const parsed = RequestSchema.safeParse(candidate);
  if (!parsed.success) {
    return { valid: false, errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}:${issue.message}`), request: null };
  }
  const request = parsed.data;
  /** @type {string[]} */
  const errors = [];
  if (JSON.stringify(request.scope.allowed_tables) !== JSON.stringify(ALLOWED_SHADOW_TABLES)) {
    errors.push("approval_scope_mismatch:allowed_tables");
  }
  if (request.approval.approval_scope_hash !== computeApprovalScopeHash(request)) {
    errors.push("approval_scope_mismatch:approval_scope_hash");
  }
  if (Date.parse(request.request.created_at) >= Date.parse(request.request.expires_at)) {
    errors.push("invalid_request_window");
  }
  const now = options && options.now ? options.now : new Date();
  if (Date.parse(request.request.expires_at) <= now.getTime()) errors.push("approval_expired");
  const approved = request.request.status === "APPROVED_FOR_SINGLE_WRITE";
  if (approved && (!request.approval.approved_by || !request.approval.approved_at)) {
    errors.push("approval_identity_or_time_missing");
  }
  if (!approved && (request.approval.approved_by || request.approval.approved_at)) {
    errors.push("approval_fields_present_without_approved_status");
  }
  if (options && options.requireApproved && !approved) errors.push("approved_single_write_required");
  return { valid: errors.length === 0, errors, request };
}

/** @param {string} text @param {{ requireApproved?: boolean, now?: Date }=} options */
function parseShadowWriteRequestYaml(text, options) {
  let document;
  try {
    document = yaml.safeLoad(text, { json: true });
  } catch (error) {
    return { valid: false, errors: [`yaml_parse_failed:${error instanceof Error ? error.message : String(error)}`], request: null };
  }
  return validateShadowWriteRequest(document, options);
}

module.exports = {
  ALLOWED_SHADOW_TABLES,
  SHADOW_TABLE_ROW_LIMITS,
  HISTORICAL_TECHNICAL_TEST_LEAD_IDS,
  computeApprovalScopeHash,
  computeCandidateEvidenceHash,
  computeInputSnapshotHash,
  parseShadowWriteRequestYaml,
  validateShadowWriteRequest,
};
