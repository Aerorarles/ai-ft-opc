// @ts-check

const { MemoryAuditRepository } = require("../../packages/persistence/src/index.ts");
const { appendAuditEvent } = require("../../packages/audit/src/index.ts");

let failures = 0;
/** @param {string} name @param {() => Promise<void> | void} test */
async function run(name, test) { try { await test(); console.log(`PASS ${name}`); } catch (error) { failures += 1; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`); } }

function eventInput(repository, overrides = {}) {
  return { repository, tenant_id: "local", request_trace_id: "m1-audit-trace", idempotency_key: "m1-audit-intake", event_type: "intake_completed", entity_type: "intake_run", entity_id: "intake-1", intake_run_id: "intake-1", payload_summary: { candidate_count: 1, has_email: true }, ...overrides };
}

(async () => {
  await run("appends sanitized correlated events in sequence", async () => {
    const repository = new MemoryAuditRepository();
    await appendAuditEvent(eventInput(repository));
    await appendAuditEvent(eventInput(repository, { idempotency_key: "m1-audit-shadow", event_type: "shadow_persisted", entity_type: "shadow_result", entity_id: "shadow-result-1", shadow_run_id: "shadow-run-1", shadow_result_id: "shadow-result-1", payload_summary: { total_score: 21, replay_consistency: true } }));
    await appendAuditEvent(eventInput(repository, { idempotency_key: "m1-audit-review", event_type: "review_decided", entity_type: "review_decision", entity_id: "review-decision-1", review_item_id: "review-1", review_decision_id: "review-decision-1", payload_summary: { decision: "approved", note_present: true } }));
    const events = await repository.getAuditEventsByTrace("m1-audit-trace");
    if (events.length !== 3 || events.map((event) => event.sequence_index).join(",") !== "0,1,2") throw new Error("audit_sequence_invalid");
  });
  await run("reuses duplicate audit idempotency key", async () => {
    const repository = new MemoryAuditRepository();
    const first = await appendAuditEvent(eventInput(repository));
    const second = await appendAuditEvent(eventInput(repository));
    if (first.reused || !second.reused || first.event.audit_event_id !== second.event.audit_event_id) throw new Error("audit_idempotency_failed");
  });
  await run("blocks prohibited audit summary keys without exposing values", async () => {
    const repository = new MemoryAuditRepository();
    try { await appendAuditEvent(eventInput(repository, { payload_summary: { email: "not-for-persistence" } })); throw new Error("unsafe_audit_accepted"); }
    catch (error) { if (!String(error).includes("prohibited_persistence_key:email")) throw error; }
  });
  await run("queries audit events by entity without raw payload", async () => {
    const repository = new MemoryAuditRepository();
    await appendAuditEvent(eventInput(repository));
    const events = await repository.getAuditEventsByEntity("intake_run", "intake-1");
    const serialized = JSON.stringify(events);
    if (events.length !== 1 || serialized.includes("not-for-persistence") || serialized.includes("raw_data")) throw new Error("audit_entity_query_invalid");
  });
  if (failures > 0) process.exitCode = 1;
})();
