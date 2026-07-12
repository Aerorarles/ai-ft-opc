// @ts-check

const {
  MemoryIntakeRepository,
  MemoryAuditRepository,
  auditReplaySafety,
  buildIdempotencyKey,
  validateIdempotencyReplayEnvelope,
} = require("../../packages/persistence/src/index.ts");
const { persistIntakeSubmission } = require("../../packages/intake-persistence/src/index.ts");
const { appendAuditEvent } = require("../../packages/audit/src/index.ts");
const { createSeedRepositories, seedPhase2 } = require("./phase2-seed.ts");
const { runSingleLeadShadow, recordReviewDecision } = require("../../packages/phase2-domain/src/index.ts");

let failures = 0;
/** @param {string} name @param {() => Promise<void> | void} test */
async function run(name, test) {
  try { await test(); console.log(`PASS ${name}`); }
  catch (error) { failures += 1; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`); }
}

function intakeInput(repository, overrides = {}) {
  return {
    repository,
    tenant_id: "local",
    request_trace_id: "m1-wp06-intake-trace",
    idempotency_key: "m1-wp06-intake-key",
    trigger_source: "manual",
    lead: { company_name: "Example Display Factory", website: "https://example.test", country: "US", industry: "Retail Display Manufacturing" },
    ...overrides,
  };
}

async function setupShadow() {
  const repositories = createSeedRepositories();
  await seedPhase2(repositories);
  const shadow = await runSingleLeadShadow({
    lead_id: "lead-factory-high",
    leadRepository: repositories.leadRepository,
    shadowRepository: repositories.shadowRepository,
    reviewRepository: repositories.reviewRepository,
    config_version: "v1",
    request_trace_id: "m1-wp06-shadow-trace",
    idempotency_key: "m1-wp06-shadow-key",
    tenant_id: "local",
    trigger_source: "manual",
    allow_shadow_write: true,
  });
  if (!shadow.review_item) throw new Error("review_item_not_created");
  return { repositories, shadow };
}

function auditInput(repository, overrides = {}) {
  return {
    repository,
    tenant_id: "local",
    request_trace_id: "m1-wp06-audit-trace",
    idempotency_key: "m1-wp06-audit-intake",
    event_type: "intake_completed",
    entity_type: "intake_run",
    entity_id: "intake-1",
    intake_run_id: "intake-1",
    payload_summary: { candidate_count: 1 },
    ...overrides,
  };
}

(async () => {
  await run("validates shared idempotency semantics and masks derived entity material", () => {
    const validation = validateIdempotencyReplayEnvelope({ tenant_id: "local", request_trace_id: "trace-1", idempotency_key: "key-1", operation: "shadow_run", replay_behavior: "reuse_existing" });
    const key = buildIdempotencyKey({ operation: "shadow_run", request_trace_id: "trace-1", entity_id: "lead-sensitive-id" });
    if (!validation.valid || !key.startsWith("shadow_run:") || key.includes("lead-sensitive-id")) throw new Error("idempotency_contract_invalid");
  });

  await run("blocks missing keys before intake mutation", async () => {
    const repository = new MemoryIntakeRepository();
    try { await persistIntakeSubmission(intakeInput(repository, { idempotency_key: "" })); throw new Error("missing_key_accepted"); }
    catch (error) {
      const message = String(error);
      if (!message.includes("missing_scope:idempotency_key") && !message.includes("missing_idempotency_scope:idempotency_key")) throw error;
    }
    if (await repository.getIntakeRunByIdempotencyKey("local", "m1-wp06-intake-key")) throw new Error("invalid_intake_mutated_repository");
  });

  await run("reuses tenant-scoped intake and shadow requests without duplicates", async () => {
    const intakeRepository = new MemoryIntakeRepository();
    const intakeFirst = await persistIntakeSubmission(intakeInput(intakeRepository));
    const intakeSecond = await persistIntakeSubmission(intakeInput(intakeRepository));
    if (intakeFirst.reused || !intakeSecond.reused || intakeFirst.run.intake_run_id !== intakeSecond.run.intake_run_id) throw new Error("intake_reuse_failed");
    const { repositories, shadow } = await setupShadow();
    const repeated = await runSingleLeadShadow({ lead_id: "lead-factory-high", leadRepository: repositories.leadRepository, shadowRepository: repositories.shadowRepository, reviewRepository: repositories.reviewRepository, config_version: "v1", request_trace_id: "m1-wp06-shadow-trace", idempotency_key: "m1-wp06-shadow-key", tenant_id: "local", trigger_source: "manual", allow_shadow_write: true });
    if (shadow.reused || !repeated.reused || repeated.run?.shadow_run_id !== shadow.run?.shadow_run_id) throw new Error("shadow_reuse_failed");
  });

  await run("reuses a review action and rejects a different terminal action", async () => {
    const { repositories, shadow } = await setupShadow();
    const input = { reviewRepository: repositories.reviewRepository, review_item_id: shadow.review_item.review_item_id, review_status: "approved", reviewer_id: "reviewer-1", request_trace_id: "m1-wp06-review-trace", idempotency_key: "m1-wp06-review-key" };
    const first = await recordReviewDecision(input);
    const second = await recordReviewDecision(input);
    if (first.reused || !second.reused || first.decision.review_decision_id !== second.decision.review_decision_id) throw new Error("review_reuse_failed");
    try { await recordReviewDecision({ ...input, review_status: "rejected", idempotency_key: "m1-wp06-review-other-key" }); throw new Error("terminal_review_replayed"); }
    catch (error) { if (!String(error).includes("review_item_not_pending")) throw error; }
  });

  await run("replays sanitized audit events without re-running business operations", async () => {
    const repository = new MemoryAuditRepository();
    await appendAuditEvent(auditInput(repository));
    await appendAuditEvent(auditInput(repository, { idempotency_key: "m1-wp06-audit-shadow", event_type: "shadow_persisted", entity_type: "shadow_result", entity_id: "shadow-1", shadow_result_id: "shadow-1", payload_summary: { total_score: 21 } }));
    await appendAuditEvent(auditInput(repository, { idempotency_key: "m1-wp06-audit-review", event_type: "review_decided", entity_type: "review_decision", entity_id: "review-1", review_decision_id: "review-1", payload_summary: { decision: "approved" } }));
    const replay = auditReplaySafety({ request_trace_id: "m1-wp06-audit-trace", events: await repository.getAuditEventsByTrace("m1-wp06-audit-trace"), expected_event_types: ["intake_completed", "shadow_persisted", "review_decided"] });
    if (!replay.is_consistent || replay.replay_mode !== "audit_only" || replay.event_count !== 3) throw new Error("audit_replay_failed");
  });

  await run("flags missing and out-of-order audit events for review", () => {
    const replay = auditReplaySafety({
      request_trace_id: "m1-wp06-bad-trace",
      events: [
        { request_trace_id: "m1-wp06-bad-trace", tenant_id: "local", idempotency_key: "one", event_type: "shadow_persisted", sequence_index: 1 },
        { request_trace_id: "m1-wp06-bad-trace", tenant_id: "local", idempotency_key: "two", event_type: "intake_completed", sequence_index: 0 },
      ],
      expected_event_types: ["intake_completed", "shadow_persisted", "review_decided"],
    });
    if (replay.is_consistent || !replay.consistency_errors.includes("audit_event_order_violation") || !replay.consistency_errors.includes("missing_expected_audit_event:review_decided")) {
      throw new Error("unsafe_audit_order_accepted");
    }
  });

  await run("preserves v0.1 facts during idempotent shadow execution", async () => {
    const repositories = createSeedRepositories();
    await seedPhase2(repositories);
    const before = await repositories.leadRepository.getLeadSnapshot("lead-factory-high");
    await runSingleLeadShadow({
      lead_id: "lead-factory-high",
      leadRepository: repositories.leadRepository,
      shadowRepository: repositories.shadowRepository,
      reviewRepository: repositories.reviewRepository,
      config_version: "v1",
      request_trace_id: "m1-wp06-v01-trace",
      idempotency_key: "m1-wp06-v01-key",
      tenant_id: "local",
      trigger_source: "manual",
      allow_shadow_write: true,
    });
    const after = await repositories.leadRepository.getLeadSnapshot("lead-factory-high");
    if (before.v01_score !== after.v01_score || before.v01_grade !== after.v01_grade || before.v01_priority !== after.v01_priority) throw new Error("v01_facts_changed");
  });

  if (failures > 0) process.exitCode = 1;
})();
