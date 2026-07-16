// @ts-check

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");
const {
  ALLOWED_SHADOW_TABLES,
  SHADOW_TABLE_ROW_LIMITS,
  computeApprovalScopeHash,
  computeCandidateEvidenceHash,
  computeInputSnapshotHash,
  parseShadowWriteRequestYaml,
} = require("../../packages/persistence/src/shadow-write-request.ts");
const {
  currentConfigArtifactHash,
  currentWriterPackageHash,
  executeApprovedSingleLeadShadowWrite,
} = require("../../packages/persistence/src/postgres/single-lead-shadow-writer.ts");

const LEAD_ID = "0d5be96b-7214-4f50-964f-36f97b8da6f2";
const leadRow = Object.freeze({
  lead_id: LEAD_ID,
  company_name: "Safe Display Buyer",
  website: "https://safe-display.example",
  country: "US",
  industry: "Retail display",
  has_email: true,
  has_phone: false,
  v01_score: 20,
  v01_grade: "C",
  v01_priority: "low",
  enrichment_status: "succeeded",
  business_status: "new",
  source: "serper",
});

function evidenceSummary(row = leadRow) {
  return {
    lead_id: row.lead_id, company_name: row.company_name,
    v01_score: row.v01_score, v01_grade: row.v01_grade,
    v01_priority: row.v01_priority, enrichment_status: row.enrichment_status,
    business_status: row.business_status, competitor_flag: false,
    test_sample_flag: false, suppression_flag: false,
    recommendation: "eligible_for_shadow_review",
  };
}

function inputSnapshot(row = leadRow) {
  return {
    lead_id: row.lead_id, company_name: row.company_name, website: row.website,
    country: row.country, industry: row.industry, has_email: row.has_email,
    has_phone: row.has_phone, v01_score: row.v01_score, v01_grade: row.v01_grade,
    v01_priority: row.v01_priority, business_status: row.business_status,
    enrichment_status: row.enrichment_status,
  };
}

function approvedRequest() {
  const now = Date.now();
  const request = {
    request: {
      id: "swr-test-approved", trace_id: "7ab16736-e5b5-4d66-ae48-2e34b864e23e",
      idempotency_key: "a".repeat(64), status: "APPROVED_FOR_SINGLE_WRITE",
      created_at: new Date(now - 60_000).toISOString(), expires_at: new Date(now + 3_600_000).toISOString(),
    },
    candidate_selection: {
      evidence_hash: computeCandidateEvidenceHash(evidenceSummary()),
      input_snapshot_hash: computeInputSnapshotHash(inputSnapshot()),
      selected_from_live_read: true, exclusion_policy_version: "m1-shadow-candidate-v1",
    },
    target: { tenant_id: "local", lead_id: LEAD_ID, company_name: leadRow.company_name },
    versions: {
      config_version: "v1",
      config_artifact_sha256: currentConfigArtifactHash(),
      config_checksum: "926d3074d0aa4dd34049b2e38df34a3949c2fcac4fc45c91f22f23dc384adfd4",
      engine_version: "0.6", outcome_policy: "not-configured",
    },
    writer: {
      package_sha256: currentWriterPackageHash(), implementation: "single-lead-shadow-writer-v1",
      database_role: "aiopc_shadow_writer_m1",
    },
    scope: {
      max_entities: 1, transaction_required: true,
      allowed_tables: [...ALLOWED_SHADOW_TABLES], max_rows: { ...SHADOW_TABLE_ROW_LIMITS }, total_max_rows: 10,
    },
    prohibitions: {
      modify_public_leads: false, modify_v01_score_facts: false,
      create_review_queue_data: false, external_outreach: false,
      execute_migration: false, enable_writer: false,
    },
    approval: {
      required: true, approved_by: "owner", approved_at: new Date(now - 30_000).toISOString(),
      approval_scope_hash: "0".repeat(64),
    },
    rollback: { owner: "Jiaolong Li", mode: "transaction_or_separate_approval" },
  };
  request.approval.approval_scope_hash = computeApprovalScopeHash(request);
  return request;
}

class FakeClient {
  /** @type {{ failAt?: string, existingClaim?: boolean, claimStatus?: string, changedV01?: boolean }} */
  options;
  /** @type {{ sql: string, params: unknown[] }[]} */
  calls;

  /** @param {{ failAt?: string, existingClaim?: boolean, claimStatus?: string, changedV01?: boolean }=} options */
  constructor(options = {}) {
    this.options = options;
    this.calls = [];
  }

  async query(sql, params) {
    this.calls.push({ sql, params: params || [] });
    if (this.options.failAt && sql.includes(this.options.failAt)) throw new Error("injected_database_failure");
    if (sql.includes("shadow_writer:select_lead")) return { rows: [{ ...leadRow }], rowCount: 1 };
    if (sql.includes("shadow_writer:check_idempotency")) {
      return this.options.existingClaim
        ? { rows: [{ idempotency_claim_id: "existing", claim_status: this.options.claimStatus || "completed" }], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    if (sql.includes("shadow_writer:verify_v01")) {
      const row = this.options.changedV01
        ? { v01_score: 999, v01_grade: "A", v01_priority: "high" }
        : { v01_score: leadRow.v01_score, v01_grade: leadRow.v01_grade, v01_priority: leadRow.v01_priority };
      return { rows: [row], rowCount: 1 };
    }
    if (sql.includes("RETURNING")) return { rows: [{ id: "written" }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  }
}

async function expectFailure(name, fn, pattern) {
  let error = null;
  try { await fn(); } catch (caught) { error = caught; }
  assert.ok(error, `${name}: expected failure`);
  assert.match(String(error && error.message), pattern, `${name}: unexpected error`);
  process.stdout.write(`PASS ${name}\n`);
}

async function main() {
  const structured = parseShadowWriteRequestYaml(yaml.safeDump(approvedRequest()), { requireApproved: true });
  assert.equal(structured.valid, true, structured.errors.join(","));
  process.stdout.write("PASS parses the approval request as structured YAML and validates the exact scope\n");

  const successClient = new FakeClient();
  const result = await executeApprovedSingleLeadShadowWrite(successClient, approvedRequest());
  assert.equal(successClient.calls[0].sql, "BEGIN");
  assert.equal(successClient.calls.at(-1).sql, "COMMIT");
  assert.equal(result.database_writes <= 10, true);
  assert.equal(result.public_leads_changed, false);
  assert.equal(result.v01_facts_changed, false);
  assert.equal(result.review_queue_created, false);
  const allSql = successClient.calls.map((call) => call.sql).join("\n");
  assert.doesNotMatch(allSql, /(?:INSERT\s+INTO|UPDATE)\s+public\.leads\b/i);
  assert.doesNotMatch(allSql, /lead_review_queue|lead_review_decisions/i);
  assert.doesNotMatch(allSql, /\b(?:CREATE|ALTER|DROP|TRUNCATE|DELETE|GRANT|REVOKE)\b/i);
  process.stdout.write("PASS commits one bounded six-table transaction without leads or review writes\n");

  /** @type {Array<[string, (request: any) => void]>} */
  const invalidMutations = [
    ["missing approval", (r) => { r.request.status = "PENDING_APPROVAL"; r.approval.approved_by = null; r.approval.approved_at = null; }],
    ["expired approval", (r) => { r.request.expires_at = new Date(Date.now() - 1_000).toISOString(); }],
    ["scope mismatch", (r) => { r.scope.allowed_tables = r.scope.allowed_tables.slice(1); }],
    ["hash mismatch", (r) => { r.approval.approval_scope_hash = "f".repeat(64); }],
    ["version mismatch", (r) => { r.versions.engine_version = "0.7"; }],
    ["tenant mismatch", (r) => { r.target.tenant_id = "other"; }],
    ["lead mismatch", (r) => { r.target.lead_id = "6ab4b6c8-daae-4d60-ab25-184e57c4bb20"; }],
    ["sensitive request field", (r) => { r.credentials = "prohibited"; }],
  ];
  for (const entry of invalidMutations) {
    const name = entry[0] as string;
    const mutate = entry[1] as (request: any) => void;
    const request = JSON.parse(JSON.stringify(approvedRequest()));
    mutate(request);
    const client = new FakeClient();
    await expectFailure(String(name), () => executeApprovedSingleLeadShadowWrite(client, request), /approval_scope_mismatch/);
    assert.equal(client.calls.length, 0, `${name}: must fail before BEGIN`);
  }

  const reusedClient = new FakeClient({ existingClaim: true });
  const reused = await executeApprovedSingleLeadShadowWrite(reusedClient, approvedRequest());
  assert.equal(reused.reused, true);
  assert.equal(reused.database_writes, 0);
  assert.equal(reusedClient.calls.some((call) => /INSERT\s+INTO/i.test(call.sql)), false);
  assert.equal(reusedClient.calls.at(-1).sql, "ROLLBACK");
  process.stdout.write("PASS reuses a completed idempotency claim without a second write\n");

  const failureClient = new FakeClient({ failAt: "shadow_writer:insert_diff" });
  await expectFailure("rolls back an interrupted insert sequence", () => executeApprovedSingleLeadShadowWrite(failureClient, approvedRequest()), /injected_database_failure/);
  assert.equal(failureClient.calls.at(-1).sql, "ROLLBACK");

  const changedClient = new FakeClient({ changedV01: true });
  await expectFailure("rolls back when v0.1 facts change", () => executeApprovedSingleLeadShadowWrite(changedClient, approvedRequest()), /v01_facts_changed/);
  assert.equal(changedClient.calls.at(-1).sql, "ROLLBACK");

  const writerSource = fs.readFileSync(path.resolve("packages/persistence/src/postgres/single-lead-shadow-writer.ts"), "utf8");
  assert.match(writerSource, /applied_rules\.length > request\.scope\.max_rows/);
  assert.match(writerSource, /row_limit_violation:explanations/);
  const candidateScript = fs.readFileSync(path.resolve("scripts/shadow-write/select-candidates.ps1"), "utf8");
  assert.match(candidateScript, /ValidateRange\(1, 3\)/);
  assert.match(candidateScript, /competitor/);
  assert.match(candidateScript, /suppressed/);
  assert.match(candidateScript, /lead_operation_idempotency_claims/);
  assert.doesNotMatch(candidateScript, /raw_data/);
  const preflightScript = fs.readFileSync(path.resolve("scripts/shadow-write/preflight.ps1"), "utf8");
  assert.match(preflightScript, /BEGIN READ ONLY/);
  assert.match(preflightScript, /transaction_read_only/);
  process.stdout.write("PASS enforces explanation limits and statically guards preflight/candidate scripts\n");
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
