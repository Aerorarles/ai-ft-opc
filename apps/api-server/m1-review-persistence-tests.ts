// @ts-check

const { createSeedRepositories, seedPhase2 } = require("./phase2-seed.ts");
const { runSingleLeadShadow, recordReviewDecision } = require("../../packages/phase2-domain/src/index.ts");
const { validateReviewPersistenceEnvelope, PostgresReviewRepository, DISABLED_MESSAGE } = require("../../packages/persistence/src/index.ts");

let failures = 0;

/** @param {string} name @param {() => Promise<void> | void} test */
async function run(name, test) {
  try {
    await test();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function setup() {
  const repositories = createSeedRepositories();
  await seedPhase2(repositories);
  const shadow = await runSingleLeadShadow({
    lead_id: "lead-factory-high",
    leadRepository: repositories.leadRepository,
    shadowRepository: repositories.shadowRepository,
    reviewRepository: repositories.reviewRepository,
    config_version: "v1",
    request_trace_id: "m1-review-shadow",
    idempotency_key: "m1-review-shadow-key",
    tenant_id: "local",
    trigger_source: "manual",
    allow_shadow_write: true,
  });
  if (!shadow.review_item) throw new Error("review_item_not_created");
  return { repositories, reviewItem: shadow.review_item };
}

function validEnvelope() {
  return {
    scope: {
      tenant_id: "local",
      organization_id: null,
      actor_user_id: "local-operator",
      request_trace_id: "m1-review-contract",
      idempotency_key: "m1-review-contract-key",
    },
    review_item: {
      review_item_id: "review-1",
      lead_id: "lead-1",
      shadow_result_id: "shadow-result-1",
      review_status: "approved",
    },
    decision: {
      decision: "approved",
      decided_by: "reviewer-1",
      decision_notes_summary: "note_present(length=10)",
    },
  };
}

(async () => {
  await run("valid review envelope passes", () => {
    const validation = validateReviewPersistenceEnvelope(validEnvelope());
    if (!validation.valid) throw new Error(`unexpected_contract_errors:${validation.errors.join(",")}`);
  });

  await run("review contract blocks missing reviewer and prohibited keys", () => {
    const invalid = validEnvelope();
    invalid.decision.decided_by = "";
    const unsafe = { ...invalid, review_item: { ...invalid.review_item, email: "not-for-persistence" } };
    const validation = validateReviewPersistenceEnvelope(unsafe);
    if (validation.valid) throw new Error("invalid_review_contract_accepted");
    if (!validation.errors.includes("missing_reviewer_identity")) throw new Error("reviewer_requirement_missing");
    if (!validation.errors.includes("prohibited_persistence_key:email")) throw new Error("prohibited_key_not_detected");
  });

  await run("review contract blocks raw note text masquerading as a summary", () => {
    const invalid = validEnvelope();
    invalid.decision.decision_notes_summary = "raw note text";
    const validation = validateReviewPersistenceEnvelope(invalid);
    if (validation.valid || !validation.errors.includes("invalid_review_note_summary")) {
      throw new Error("raw_note_summary_not_blocked");
    }
  });

  await run("pending review becomes approved with append-only decision audit", async () => {
    const { repositories, reviewItem } = await setup();
    const result = await recordReviewDecision({
      reviewRepository: repositories.reviewRepository,
      review_item_id: reviewItem.review_item_id,
      review_status: "approved",
      reviewer_id: "reviewer-local-1",
      request_trace_id: "m1-review-approve",
      idempotency_key: "m1-review-approve-key",
      review_note: "Contact example@example.test before deciding",
    });
    if (result.reused || result.item.review_status !== "approved" || result.item.reviewed_by !== "reviewer-local-1") {
      throw new Error("review_transition_failed");
    }
    const history = await repositories.reviewRepository.getReviewDecisionHistory(reviewItem.review_item_id);
    if (history.length !== 1 || history[0].decision !== "approved") throw new Error("review_audit_not_appended");
    const serialized = JSON.stringify({ item: result.item, history });
    if (serialized.includes("example@example.test") || serialized.includes("Contact example")) {
      throw new Error("raw_review_note_persisted");
    }
    if (!serialized.includes("note_present(length=")) throw new Error("review_note_summary_missing");
  });

  await run("same idempotency key reuses the same decision", async () => {
    const { repositories, reviewItem } = await setup();
    const input = {
      reviewRepository: repositories.reviewRepository,
      review_item_id: reviewItem.review_item_id,
      review_status: "skipped",
      reviewer_id: "reviewer-local-2",
      request_trace_id: "m1-review-idempotency",
      idempotency_key: "m1-review-idempotency-key",
      review_note: "Local test only",
    };
    const first = await recordReviewDecision(input);
    const second = await recordReviewDecision(input);
    if (first.reused || !second.reused || first.decision.review_decision_id !== second.decision.review_decision_id) {
      throw new Error("review_idempotency_not_reused");
    }
    if ((await repositories.reviewRepository.getReviewDecisionHistory(reviewItem.review_item_id)).length !== 1) {
      throw new Error("duplicate_review_decision_created");
    }
  });

  await run("terminal review cannot be decided again with a new key", async () => {
    const { repositories, reviewItem } = await setup();
    await recordReviewDecision({
      reviewRepository: repositories.reviewRepository,
      review_item_id: reviewItem.review_item_id,
      review_status: "rejected",
      reviewer_id: "reviewer-local-3",
      request_trace_id: "m1-review-terminal-first",
      idempotency_key: "m1-review-terminal-first-key",
    });
    let blocked = false;
    try {
      await recordReviewDecision({
        reviewRepository: repositories.reviewRepository,
        review_item_id: reviewItem.review_item_id,
        review_status: "approved",
        reviewer_id: "reviewer-local-4",
        request_trace_id: "m1-review-terminal-second",
        idempotency_key: "m1-review-terminal-second-key",
      });
    } catch (error) {
      blocked = String(error).includes("review_item_not_pending");
    }
    if (!blocked) throw new Error("terminal_review_was_redecided");
  });

  await run("PostgreSQL review adapter rejects writes by default", async () => {
    const fakeClient = { query: async () => ({ rows: [] }) };
    const repository = new PostgresReviewRepository(fakeClient);
    let rejected = false;
    try {
      await repository.recordReviewDecision("review-1", {});
    } catch (error) {
      rejected = String(error).includes(DISABLED_MESSAGE);
    }
    if (!rejected) throw new Error("postgres_review_writer_not_guarded");
  });

  if (failures > 0) process.exitCode = 1;
})();
