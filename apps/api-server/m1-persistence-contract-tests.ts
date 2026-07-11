// @ts-check

const {
  LOGICAL_PERSISTENCE_ENTITIES,
  PROHIBITED_PERSISTENCE_FIELDS,
  validatePersistenceContractEnvelope,
} = require("../../packages/persistence/src/index.ts");

let failures = 0;

/**
 * @param {string} name
 * @param {() => void} test
 */
function run(name, test) {
  try {
    test();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * @returns {Record<string, any>}
 */
function validEnvelope() {
  return {
    scope: {
      tenant_id: "local",
      organization_id: null,
      actor_user_id: null,
      request_trace_id: "m1-contract-test",
      idempotency_key: "m1-contract-test-key",
    },
    version_anchors: {
      config_version_id: "v1",
      config_checksum: "config-checksum",
      engine_version: "0.7",
      outcome_policy_id: "default-policy",
      outcome_policy_version: "v1",
      outcome_policy_checksum: "policy-checksum",
    },
    run_mode: "shadow",
    input_summary: { has_email: true, signals_count: 2 },
    audit_summary: { action: "shadow_scoring_preview" },
  };
}

run("logical entity contract is complete", () => {
  const expected = ["lead_snapshot", "shadow_scoring_run", "shadow_scoring_result", "shadow_scoring_diff", "review_queue_item", "review_decision", "audit_event"];
  for (const entity of expected) {
    if (!LOGICAL_PERSISTENCE_ENTITIES.includes(entity)) throw new Error(`missing_entity:${entity}`);
  }
});

run("valid sanitized envelope passes", () => {
  const result = validatePersistenceContractEnvelope(validEnvelope());
  if (!result.valid || result.errors.length > 0) throw new Error(`unexpected_errors:${result.errors.join(",")}`);
});

run("missing version anchors are blocked", () => {
  const input = validEnvelope();
  input.version_anchors.config_checksum = "";
  const result = validatePersistenceContractEnvelope(input);
  if (result.valid || !result.errors.includes("missing_version_anchor:config_checksum")) {
    throw new Error("missing_anchor_not_detected");
  }
});

run("sensitive persistence keys are blocked without exposing values", () => {
  const input = validEnvelope();
  /** @type {Record<string, unknown>} */
  const prohibitedSummary = { has_email: true, signals_count: 2, email: "not-for-persistence" };
  input.input_summary = prohibitedSummary;
  const result = validatePersistenceContractEnvelope(input);
  if (result.valid || !result.errors.includes("prohibited_persistence_key:email")) {
    throw new Error("prohibited_key_not_detected");
  }
  if (!PROHIBITED_PERSISTENCE_FIELDS.includes("credentials")) throw new Error("credentials_rule_missing");
});

if (failures > 0) process.exitCode = 1;
