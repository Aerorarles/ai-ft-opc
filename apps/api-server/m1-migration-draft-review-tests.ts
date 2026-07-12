// @ts-check

const fs = require("node:fs");
const path = require("node:path");

const draftPath = path.resolve(__dirname, "../../database/migrations/DRAFT-007-m1-intake-audit-idempotency.sql");
const draft = fs.readFileSync(draftPath, "utf8");

let failures = 0;
/** @param {string} name @param {() => void} test */
function run(name, test) {
  try { test(); console.log(`PASS ${name}`); }
  catch (error) { failures += 1; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`); }
}

run("marks the migration as draft-only and transaction-bounded", () => {
  if (!draft.includes("DRAFT") || !draft.includes("BEGIN;") || !draft.includes("COMMIT;")) throw new Error("draft_markers_missing");
});

run("covers intake, idempotency, and sanitized audit persistence", () => {
  for (const table of ["lead_intake_runs", "lead_intake_source_items", "lead_intake_candidates", "lead_operation_idempotency_claims", "lead_audit_events"]) {
    if (!draft.includes(`public.${table}`)) throw new Error(`missing_table:${table}`);
  }
  for (const fragment of ["tenant_id, idempotency_key", "request_trace_id", "sequence_index", "payload_summary"]) {
    if (!draft.includes(fragment)) throw new Error(`missing_contract_fragment:${fragment}`);
  }
});

run("does not alter v0.1 lead scoring or introduce destructive statements", () => {
  for (const prohibited of ["ALTER TABLE public.leads", "UPDATE public.leads", "CREATE TRIGGER", "CREATE OR REPLACE FUNCTION", "DROP ", "TRUNCATE", "DELETE FROM"]) {
    if (draft.includes(prohibited)) throw new Error(`prohibited_sql_fragment:${prohibited.trim()}`);
  }
});

run("documents sensitive-field exclusion without storing field values", () => {
  for (const required of ["raw_data", "HTML", "headers", "cookies", "credentials", "secrets"]) {
    if (!draft.includes(required)) throw new Error(`missing_sensitive_boundary:${required}`);
  }
});

if (failures > 0) process.exitCode = 1;
