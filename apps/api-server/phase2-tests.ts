const { createSeedRepositories, seedPhase2 } = require("./phase2-seed.ts");
const { createPhase2Api } = require("./phase2-api.ts");
const { runSingleLeadShadow } = require("../../packages/phase2-domain/src/index.ts");
const { PostgresShadowRepository, DISABLED_MESSAGE } = require("../../packages/persistence/src/index.ts");
const { startPhase2HttpServer } = require("./phase2-http-server.ts");

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}. Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertTrue(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoSensitiveFields(value, message) {
  const text = JSON.stringify(value).toLowerCase();
  for (const forbidden of ["@", "+1 000", "raw_data", "cookie", "headers", "credentials", "stack"]) {
    if (text.includes(forbidden)) throw new Error(`${message}: found ${forbidden}`);
  }
}

async function setup() {
  const repositories = createSeedRepositories();
  await seedPhase2(repositories);
  return repositories;
}

const tests: Array<[string, () => Promise<void>]> = [
  ["Lead Snapshot does not expose full email / phone / raw_data", async () => {
    const repositories = await setup();
    const lead = await repositories.leadRepository.getLeadSnapshot("lead-factory-high");
    assertEqual(lead.has_email, true, "Snapshot keeps email existence only");
    assertEqual(lead.has_phone, true, "Snapshot keeps phone existence only");
    assertNoSensitiveFields(lead, "Snapshot should be sanitized");
  }],
  ["Memory repository stores lead/shadow/review", async () => {
    const repositories = await setup();
    await runSingleLeadShadow({ lead_id: "lead-factory-high", leadRepository: repositories.leadRepository, shadowRepository: repositories.shadowRepository, reviewRepository: repositories.reviewRepository, config_version: "v1", request_trace_id: "t-memory", trigger_source: "manual", allow_shadow_write: true });
    assertTrue((await repositories.shadowRepository.getShadowHistoryByLead("lead-factory-high")).length === 1, "Shadow history should persist");
    assertTrue((await repositories.reviewRepository.listReviewQueue()).length === 1, "Review item should persist");
  }],
  ["Preview does not persist", async () => {
    const repositories = await setup();
    await runSingleLeadShadow({ lead_id: "lead-factory-high", leadRepository: repositories.leadRepository, shadowRepository: repositories.shadowRepository, reviewRepository: repositories.reviewRepository, config_version: "v1", request_trace_id: "t-preview", trigger_source: "manual", allow_shadow_write: false });
    assertEqual((await repositories.shadowRepository.getShadowHistoryByLead("lead-factory-high")).length, 0, "Preview should not persist");
  }],
  ["Memory Shadow Run generates run/result/diff/review", async () => {
    const repositories = await setup();
    const result = await runSingleLeadShadow({ lead_id: "lead-big-delta", leadRepository: repositories.leadRepository, shadowRepository: repositories.shadowRepository, reviewRepository: repositories.reviewRepository, config_version: "v1", request_trace_id: "t-persist", trigger_source: "manual", allow_shadow_write: true });
    assertTrue(Boolean(result.run.shadow_run_id), "Run id should exist");
    assertTrue(Boolean(result.result.shadow_result_id), "Result id should exist");
    assertTrue(Boolean(result.diff.shadow_diff_id), "Diff id should exist");
    assertTrue(Boolean(result.review_item.review_item_id), "Review id should exist");
  }],
  ["v0.1 score/grade/priority unchanged", async () => {
    const repositories = await setup();
    const before = await repositories.leadRepository.getLeadSnapshot("lead-big-delta");
    await runSingleLeadShadow({ lead_id: "lead-big-delta", leadRepository: repositories.leadRepository, shadowRepository: repositories.shadowRepository, reviewRepository: repositories.reviewRepository, config_version: "v1", request_trace_id: "t-v01", trigger_source: "manual", allow_shadow_write: true });
    const after = await repositories.leadRepository.getLeadSnapshot("lead-big-delta");
    assertEqual(after.v01_score, before.v01_score, "v0.1 score should not change");
    assertEqual(after.v01_grade, before.v01_grade, "v0.1 grade should not change");
    assertEqual(after.v01_priority, before.v01_priority, "v0.1 priority should not change");
  }],
  ["invalid config produces blocked + requires_review", async () => {
    const repositories = await setup();
    const result = await runSingleLeadShadow({ lead_id: "lead-invalid-config", leadRepository: repositories.leadRepository, shadowRepository: repositories.shadowRepository, reviewRepository: repositories.reviewRepository, config_version: "invalid", request_trace_id: "t-invalid", trigger_source: "manual", allow_shadow_write: true, force_invalid_config: true });
    assertEqual(result.run.run_status, "blocked", "Invalid config should block");
    assertEqual(result.diff.requires_review, true, "Blocked result requires review");
  }],
  ["replay inconsistency forces requires_review", async () => {
    const repositories = await setup();
    const result = await runSingleLeadShadow({ lead_id: "lead-factory-high", leadRepository: repositories.leadRepository, shadowRepository: repositories.shadowRepository, reviewRepository: repositories.reviewRepository, config_version: "v1", request_trace_id: "t-replay", trigger_source: "manual", allow_shadow_write: true, force_replay_inconsistency: true });
    assertEqual(result.diff.requires_review, true, "Replay inconsistency requires review");
    assertTrue(result.review_item.risk_flags.includes("replay_inconsistency"), "Review risk flags should include replay inconsistency");
  }],
  ["approve/reject/skip only affects review item", async () => {
    const repositories = await setup();
    const result = await runSingleLeadShadow({ lead_id: "lead-factory-high", leadRepository: repositories.leadRepository, shadowRepository: repositories.shadowRepository, reviewRepository: repositories.reviewRepository, config_version: "v1", request_trace_id: "t-review", trigger_source: "manual", allow_shadow_write: true });
    await repositories.reviewRepository.updateReviewDecision(result.review_item.review_item_id, { review_status: "skipped", review_notes: "test skip" });
    const lead = await repositories.leadRepository.getLeadSnapshot("lead-factory-high");
    assertEqual(lead.v01_score, 45, "Lead score should remain unchanged");
  }],
  ["API health/list/detail/history/queue return", async () => {
    const repositories = await setup();
    const api = createPhase2Api(repositories);
    assertEqual((await api.request("GET", "/api/health")).status, 200, "Health should return 200");
    assertEqual((await api.request("GET", "/api/leads")).status, 200, "List leads should return 200");
    assertEqual((await api.request("GET", "/api/leads/lead-factory-high")).status, 200, "Lead detail should return 200");
    assertEqual((await api.request("GET", "/api/leads/lead-factory-high/shadow-history")).status, 200, "History should return 200");
    assertEqual((await api.request("GET", "/api/review-queue")).status, 200, "Queue should return 200");
  }],
  ["API does not return sensitive fields", async () => {
    const repositories = await setup();
    const api = createPhase2Api(repositories);
    const response = await api.request("GET", "/api/leads");
    assertNoSensitiveFields(response.json, "API response should be sanitized");
  }],
  ["PostgreSQL adapter rejects writes by default", async () => {
    const fakeClient = { query: async () => ({ rows: [] }) };
    const repo = new PostgresShadowRepository(fakeClient);
    let rejected = false;
    try {
      await repo.createShadowRun({});
    } catch (error) {
      rejected = String(error.message).includes(DISABLED_MESSAGE);
    }
    assertEqual(rejected, true, "Postgres shadow write should reject by default");
  }],
  ["HTTP server without explicit enable does not listen", async () => {
    const server = await startPhase2HttpServer();
    assertEqual(server, null, "Server should not start without explicit enabled flag");
  }],
  ["End-to-end memory flow passes", async () => {
    const repositories = await setup();
    const api = createPhase2Api(repositories);
    const preview = await api.request("POST", "/api/shadow-runs/single-lead/preview", { lead_id: "lead-factory-high", allow_shadow_write: true, request_trace_id: "t-e2e" });
    assertEqual(preview.status, 200, "Shadow endpoint should return 200");
    assertTrue((await repositories.reviewRepository.listReviewQueue()).length === 1, "Review queue should contain item");
  }],
];

async function main() {
  for (const test of tests) {
    const name = test[0];
    const run = test[1];
    try {
      await run();
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}`);
      console.error(error && error.message ? error.message : error);
      process.exitCode = 1;
    }
  }
}

main();
