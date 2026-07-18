// @ts-check

const fs = require("node:fs");
const path = require("node:path");

const candidatePath = path.resolve(__dirname, "../../database/release-candidates/M1-PRODUCTION-DATA-FOUNDATION-v1.sql");
const candidate = fs.readFileSync(candidatePath, "utf8");
let failures = 0;

/** @param {string} name @param {() => void} test */
function run(name, test) {
  try { test(); console.log(`PASS ${name}`); }
  catch (error) { failures += 1; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`); }
}

function assertIncludes(fragment) {
  if (!candidate.includes(fragment)) throw new Error(`missing_fragment:${fragment}`);
}

run("keeps the candidate outside the automatic migration directory and transaction-bounded", () => {
  if (candidatePath.includes(`${path.sep}migrations${path.sep}`)) throw new Error("candidate_in_migrations_directory");
  assertIncludes("BEGIN;");
  assertIncludes("COMMIT;");
  assertIncludes("RELEASE CANDIDATE ONLY - NOT APPROVED FOR EXECUTION");
});

run("creates the complete M1 table set", () => {
  for (const table of [
    "lead_scoring_shadow_runs", "lead_scoring_shadow_results", "lead_scoring_shadow_diff", "lead_scoring_shadow_explanations",
    "lead_review_queue", "lead_review_decisions", "lead_intake_runs", "lead_intake_source_items", "lead_intake_candidates",
    "lead_operation_idempotency_claims", "lead_audit_events",
  ]) assertIncludes(`CREATE TABLE public.${table}`);
});

run("uses tenant-scoped keys and required review foreign keys", () => {
  for (const fragment of [
    "tenant_id text NOT NULL",
    "UNIQUE (tenant_id, operation_type, idempotency_key)",
    "UNIQUE (tenant_id, request_trace_id, sequence_index)",
    "lead_review_queue_shadow_run_tenant_fkey",
    "lead_review_queue_shadow_result_run_tenant_fkey",
    "lead_review_queue_shadow_link_check",
    "UNIQUE (shadow_result_id, shadow_run_id, tenant_id)",
    "ON DELETE RESTRICT",
  ]) assertIncludes(fragment);
});

run("preserves the candidate review boundary and version anchors", () => {
  for (const fragment of [
    "candidate_status = 'pending_review'", "dedup_status = 'not_evaluated'", "config_checksum text NOT NULL",
    "engine_version text NOT NULL", "outcome_policy_id text", "outcome_policy_checksum text", "execution_id text NOT NULL",
  ]) assertIncludes(fragment);
});

run("documents sanitized summaries without adding prohibited storage fields", () => {
  for (const fragment of ["full email", "full phone", "raw_data", "HTML", "headers", "cookies", "credentials", "secrets"]) assertIncludes(fragment);
  for (const prohibitedColumn of [" full_email ", " full_phone ", " raw_response ", " response_headers ", " cookie "]) {
    if (candidate.includes(prohibitedColumn)) throw new Error(`prohibited_column:${prohibitedColumn.trim()}`);
  }
});

run("does not change v0.1 or contain destructive SQL", () => {
  for (const prohibited of ["ALTER TABLE", "UPDATE public.leads", "DELETE FROM", "TRUNCATE", "DROP ", "CREATE TRIGGER", "CREATE OR REPLACE FUNCTION"]) {
    if (candidate.includes(prohibited)) throw new Error(`prohibited_sql_fragment:${prohibited.trim()}`);
  }
  if (candidate.includes("CREATE EXTENSION")) throw new Error("extension_must_be_preflighted_not_created");
  if (candidate.includes("CONCURRENTLY")) throw new Error("concurrent_index_not_allowed_in_single_transaction");
});

if (failures > 0) process.exitCode = 1;
