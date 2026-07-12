// @ts-check

const { createSeedRepositories, seedPhase2 } = require("./phase2-seed.ts");
const { runSingleLeadShadow } = require("../../packages/phase2-domain/src/index.ts");
const { validateShadowPersistenceEnvelope } = require("../../packages/persistence/src/index.ts");

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
  return repositories;
}

function validEnvelope() {
  return {
    scope: {
      tenant_id: "local",
      organization_id: null,
      actor_user_id: "local-operator",
      request_trace_id: "m1-shadow-contract",
      idempotency_key: "m1-shadow-contract-key",
    },
    version_anchors: {
      config_version_id: "v1",
      config_checksum: "config-checksum",
      engine_version: "0.6",
      outcome_policy_id: "not-configured",
      outcome_policy_version: "not-configured",
      outcome_policy_checksum: "not-configured",
    },
    run_mode: "shadow",
    input_summary: { has_email: true, signals_count: 2 },
    result_summary: { total_score: 21, applied_rule_count: 4 },
    diff_summary: { score_delta: -24, requires_review: true },
    explanations: [{ rule_id: "keyword-display", actual_value_summary: "array(count=1)" }],
  };
}

(async () => {
  await run("valid shadow persistence envelope passes", () => {
    const validation = validateShadowPersistenceEnvelope(validEnvelope());
    if (!validation.valid) throw new Error(`unexpected_contract_errors:${validation.errors.join(",")}`);
  });

  await run("shadow contract blocks missing anchors and sensitive keys", () => {
    const input = validEnvelope();
    input.version_anchors.config_checksum = "";
    const unsafeEnvelope = {
      ...input,
      explanations: [{ ...input.explanations[0], email: "not-for-persistence" }],
    };
    const validation = validateShadowPersistenceEnvelope(unsafeEnvelope);
    if (validation.valid) throw new Error("invalid_shadow_contract_accepted");
    if (!validation.errors.includes("missing_shadow_version_anchor:config_checksum")) {
      throw new Error("missing_anchor_not_detected");
    }
    if (!validation.errors.includes("prohibited_persistence_key:email")) {
      throw new Error("prohibited_key_not_detected");
    }
  });

  await run("memory shadow persists version anchors and sanitized explanations", async () => {
    const repositories = await setup();
    const result = await runSingleLeadShadow({
      lead_id: "lead-factory-high",
      leadRepository: repositories.leadRepository,
      shadowRepository: repositories.shadowRepository,
      reviewRepository: repositories.reviewRepository,
      config_version: "v1",
      request_trace_id: "m1-shadow-persist",
      idempotency_key: "m1-shadow-persist-key",
      tenant_id: "local",
      trigger_source: "manual",
      allow_shadow_write: true,
    });
    if (result.reused || !result.result || !result.run) throw new Error("shadow_result_not_created");
    if (!result.run.config_checksum || !result.run.outcome_policy_checksum || !result.run.idempotency_key) {
      throw new Error("run_version_anchor_missing");
    }
    if (result.result.validation_status !== "valid" || result.result.validation_errors_summary.length !== 0) {
      throw new Error("result_validation_state_invalid");
    }
    const explanations = await repositories.shadowRepository.getShadowExplanationsByResult(result.result.shadow_result_id);
    if (explanations.length !== result.result.applied_rule_count) throw new Error("explanation_count_mismatch");
    const serialized = JSON.stringify({ result: result.result, explanations });
    for (const forbidden of ["present@example.test", "+1 000", "\"expected_value\"", "headers", "cookies", "stack", "raw_data"]) {
      if (serialized.includes(forbidden)) throw new Error(`unsafe_shadow_payload:${forbidden}`);
    }
  });

  await run("tenant scoped idempotency reuses the original shadow run", async () => {
    const repositories = await setup();
    const input = {
      lead_id: "lead-factory-high",
      leadRepository: repositories.leadRepository,
      shadowRepository: repositories.shadowRepository,
      reviewRepository: repositories.reviewRepository,
      config_version: "v1",
      request_trace_id: "m1-shadow-idempotency",
      idempotency_key: "m1-shadow-idempotency-key",
      tenant_id: "local",
      trigger_source: "manual",
      allow_shadow_write: true,
    };
    const first = await runSingleLeadShadow(input);
    const second = await runSingleLeadShadow(input);
    if (first.reused || !second.reused || first.run.shadow_run_id !== second.run.shadow_run_id) {
      throw new Error("idempotency_not_reused");
    }
    if ((await repositories.shadowRepository.getShadowHistoryByLead("lead-factory-high")).length !== 1) {
      throw new Error("duplicate_shadow_history_created");
    }
    if ((await repositories.reviewRepository.listReviewQueue()).length !== 1) {
      throw new Error("duplicate_review_item_created");
    }
  });

  await run("preview does not persist shadow runs or explanations", async () => {
    const repositories = await setup();
    const result = await runSingleLeadShadow({
      lead_id: "lead-factory-high",
      leadRepository: repositories.leadRepository,
      shadowRepository: repositories.shadowRepository,
      reviewRepository: repositories.reviewRepository,
      config_version: "v1",
      request_trace_id: "m1-shadow-preview",
      trigger_source: "manual",
      allow_shadow_write: false,
    });
    if (result.mode !== "preview_only" || result.explanations.length !== 0) throw new Error("preview_mode_invalid");
    if ((await repositories.shadowRepository.getShadowHistoryByLead("lead-factory-high")).length !== 0) {
      throw new Error("preview_persisted_shadow_history");
    }
  });

  await run("shadow execution preserves v0.1 production facts", async () => {
    const repositories = await setup();
    const before = await repositories.leadRepository.getLeadSnapshot("lead-big-delta");
    await runSingleLeadShadow({
      lead_id: "lead-big-delta",
      leadRepository: repositories.leadRepository,
      shadowRepository: repositories.shadowRepository,
      reviewRepository: repositories.reviewRepository,
      config_version: "v1",
      request_trace_id: "m1-shadow-v01",
      trigger_source: "manual",
      allow_shadow_write: true,
    });
    const after = await repositories.leadRepository.getLeadSnapshot("lead-big-delta");
    if (after.v01_score !== before.v01_score || after.v01_grade !== before.v01_grade || after.v01_priority !== before.v01_priority) {
      throw new Error("v01_production_facts_changed");
    }
  });

  if (failures > 0) process.exitCode = 1;
})();
