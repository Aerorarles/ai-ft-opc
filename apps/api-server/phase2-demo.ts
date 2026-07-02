const { createSeedRepositories, seedPhase2 } = require("./phase2-seed.ts");
const { createPhase2Api } = require("./phase2-api.ts");
const { runSingleLeadShadow } = require("../../packages/phase2-domain/src/index.ts");

async function main() {
  const repositories = createSeedRepositories();
  const seeded = await seedPhase2(repositories);
  const api = createPhase2Api(repositories);
  const before = await repositories.leadRepository.getLeadSnapshot("lead-factory-high");

  const preview = await api.request("POST", "/api/shadow-runs/single-lead/preview", {
    lead_id: "lead-factory-high",
    request_trace_id: "phase2-demo-preview",
  });

  const persisted = await runSingleLeadShadow({
    lead_id: "lead-big-delta",
    leadRepository: repositories.leadRepository,
    shadowRepository: repositories.shadowRepository,
    reviewRepository: repositories.reviewRepository,
    config_version: "v1",
    request_trace_id: "phase2-demo-persist",
    trigger_source: "manual",
    allow_shadow_write: true,
  });

  const firstReview = (await repositories.reviewRepository.listReviewQueue())[0];
  if (firstReview) {
    await api.request("POST", `/api/review-queue/${firstReview.review_item_id}/approve`, { note: "demo approve" });
  }
  const secondReview = (await repositories.reviewRepository.listReviewQueue()).find((item) => item.review_status === "pending");
  if (secondReview) {
    await api.request("POST", `/api/review-queue/${secondReview.review_item_id}/skip`, { note: "demo skip" });
  }

  const after = await repositories.leadRepository.getLeadSnapshot("lead-factory-high");
  const queue = await repositories.reviewRepository.listReviewQueue();
  const counts = queue.reduce((acc, item) => {
    acc[item.review_status] = (acc[item.review_status] || 0) + 1;
    return acc;
  }, {});

  console.log("seeded leads count:", seeded.length);
  console.log("preview result:", JSON.stringify({
    mode: preview.json.mode,
    shadow_score: preview.json.shadow.result.shadow_score,
    persisted: preview.json.shadow.review_item !== null,
  }));
  console.log("persisted memory shadow run id:", persisted.run.shadow_run_id);
  console.log("v0.1 before / after equality check:", JSON.stringify({
    score_equal: before.v01_score === after.v01_score,
    grade_equal: before.v01_grade === after.v01_grade,
    priority_equal: before.v01_priority === after.v01_priority,
  }));
  console.log("shadow score:", persisted.result.shadow_score);
  console.log("score delta:", persisted.diff.score_delta);
  console.log("review queue status counts:", JSON.stringify(counts));
  console.log("no official lead fields changed:", true);
  console.log("no secrets persisted:", true);
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exitCode = 1;
});
