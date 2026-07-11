// @ts-check

const { MemoryIntakeRepository } = require("../../packages/persistence/src/index.ts");
const { persistIntakeSubmission } = require("../../packages/intake-persistence/src/index.ts");

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

function validInput(repository, overrides = {}) {
  return {
    repository,
    tenant_id: "local",
    organization_id: null,
    actor_user_id: "local-operator",
    request_trace_id: "m1-intake-test",
    idempotency_key: "m1-intake-test-key",
    trigger_source: "manual",
    source_url: "https://example.test/source?tracking=ignored",
    lead: {
      company_name: "Example Display Factory Ltd.",
      website: "https://example.test/catalog?ref=private",
      country: "us",
      industry: "Retail Display Manufacturing",
      email: "contact@example.test",
      phone: "+1 555 0100",
      notes: "factory export display",
      signals: ["factory", "export"],
    },
    ...overrides,
  };
}

(async () => {
  await run("creates a sanitized pending-review intake candidate", async () => {
    const repository = new MemoryIntakeRepository();
    const result = await persistIntakeSubmission(validInput(repository));
    if (result.reused || !result.candidate || result.candidate.candidate_status !== "pending_review") {
      throw new Error("candidate_not_created_for_review");
    }
    const serialized = JSON.stringify(result);
    for (const disallowed of ["contact@example.test", "+1 555 0100", "factory export display", "tracking=ignored", "ref=private"]) {
      if (serialized.includes(disallowed)) throw new Error(`sensitive_value_persisted:${disallowed}`);
    }
    if (result.source_item?.source_url !== "https://example.test/source") throw new Error("source_url_not_sanitized");
  });

  await run("reuses the same tenant idempotency key without duplicate records", async () => {
    const repository = new MemoryIntakeRepository();
    const first = await persistIntakeSubmission(validInput(repository));
    const second = await persistIntakeSubmission(validInput(repository));
    if (first.reused || !second.reused || first.run.intake_run_id !== second.run.intake_run_id) {
      throw new Error("idempotency_not_preserved");
    }
    const candidates = await repository.listCandidatesByRun(first.run.intake_run_id);
    if (candidates.length !== 1) throw new Error("duplicate_candidate_created");
  });

  await run("blocks missing tenant scope before persistence", async () => {
    const repository = new MemoryIntakeRepository();
    try {
      await persistIntakeSubmission(validInput(repository, { tenant_id: "" }));
      throw new Error("missing_tenant_was_accepted");
    } catch (error) {
      if (!String(error).includes("missing_scope:tenant_id")) throw error;
    }
    if (await repository.getIntakeRunByIdempotencyKey("local", "m1-intake-test-key")) {
      throw new Error("invalid_input_mutated_repository");
    }
  });

  if (failures > 0) process.exitCode = 1;
})();
