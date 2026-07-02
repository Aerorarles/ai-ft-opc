const {
  OrchestrationEngine,
  replayOrchestrationExecution,
} = require("../../packages/orchestration/src/index.ts");

const demoLead = {
  company_name: "ABC Displays",
  country: "US",
  industry: "Retail Display Manufacturing",
  email: "info@example.test",
  signals: ["factory", "export", "display"],
};

async function main() {
  const engine = new OrchestrationEngine();
  const execution = await engine.submit([
    {
      id: "task-score-demo-lead",
      agent: "scoring",
      task_kind: "lead_scoring",
      lead: demoLead,
      tenant_id: "local",
      config_version_id: "v1",
      run_mode: "preview",
      request_trace_id: "orchestration-scoring-demo",
      idempotency_key: "orchestration-scoring-demo-lead",
    },
  ]);

  const scoringResult = execution.results[0];
  const replay = replayOrchestrationExecution(execution.execution_id, execution.events);

  console.log("orchestration execution_id:", execution.execution_id);
  console.log("task state:", scoringResult.state);
  console.log("total_score:", scoringResult.total_score);
  console.log("breakdown:", JSON.stringify(scoringResult.breakdown));
  console.log("applied_rule_count:", scoringResult.applied_rule_count);
  console.log("replay_consistency:", scoringResult.replay_consistency);
  console.log("orchestration replay is_consistent:", replay.is_consistent);
  console.log("orchestration replay task state:", replay.task_states["task-score-demo-lead"]);
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exitCode = 1;
});
