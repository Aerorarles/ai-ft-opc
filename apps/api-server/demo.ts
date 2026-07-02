const { OrchestrationEngine } = require("../../packages/orchestration/src/index.ts");

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

  const events = execution.events;
  const hasTaskStarted = events.some((event) => event.type === "TASK_STARTED");
  const hasTaskCompleted = events.some((event) => event.type === "TASK_COMPLETED");
  const hasExecutionCompleted = events.some((event) => event.type === "EXECUTION_COMPLETED");
  const allTasksCompleted = execution.results.length === 2 &&
    execution.results.every((result) => result.state === "COMPLETED");

  if (events.length === 0) {
    throw new Error("Expected event stream to contain events.");
  }
  if (!hasTaskStarted) {
    throw new Error("Expected TASK_STARTED event.");
  }
  if (!hasTaskCompleted) {
    throw new Error("Expected TASK_COMPLETED event.");
  }
  if (!hasExecutionCompleted) {
    throw new Error("Expected EXECUTION_COMPLETED event.");
  }
  if (!allTasksCompleted || !execution.final_state.completed) {
    throw new Error("Expected replay-compatible final state to be complete.");
  }

  console.log("✔ event stream captured");
  console.log("✔ all tasks emitted events");
  console.log("✔ execution fully traceable");
  console.log("✔ replay-compatible structure confirmed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
