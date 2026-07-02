const {
  OrchestrationEngine,
  replayOrchestrationExecution,
} = require("../../packages/orchestration/src/index.ts");

async function main() {
  const engine = new OrchestrationEngine();
  const execution = await engine.submit([
    {
      id: "task-codex-build-scoring-engine",
      agent: "codex",
      prompt: "build scoring engine",
    },
    {
      id: "task-db-design-event-store",
      agent: "db",
      prompt: "design event store",
      dependsOn: ["task-codex-build-scoring-engine"],
    },
  ]);

  const replay = replayOrchestrationExecution(execution.execution_id, execution.events);

  console.log("replay execution_id:", replay.execution_id);
  console.log("replay event_count:", replay.event_count);
  console.log("replay task_states:", JSON.stringify(replay.task_states));
  console.log("replay is_consistent:", replay.is_consistent);
  console.log("replay consistency_errors:", JSON.stringify(replay.consistency_errors));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
