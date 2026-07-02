const {
  OrchestrationEngine,
  replayOrchestrationExecution,
} = require("../../packages/orchestration/src/index.ts");

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

type TestOrchestrationEvent = {
  sequence_index: number;
  type: string;
  execution_id: string;
  task_id?: string;
  agent_type?: string;
  result?: { taskId?: string; state: string };
  error?: string;
};

/**
 * @param {number} sequence_index
 * @param {string} type
 * @param {string=} task_id
 * @returns {TestOrchestrationEvent}
 */
function event(sequence_index, type, task_id = undefined) {
  const base: TestOrchestrationEvent = {
    sequence_index,
    type,
    execution_id: "test-execution",
  };
  if (task_id) {
    base.task_id = task_id;
    base.agent_type = task_id.includes("db") ? "db" : "codex";
  }
  if (type === "TASK_COMPLETED") {
    base.result = { taskId: task_id, state: "COMPLETED" };
  }
  if (type === "TASK_FAILED") {
    base.error = "mock failure";
  }
  return base;
}

const tests = [
  {
    name: "normal completed execution can be replayed",
    run: async () => {
      const engine = new OrchestrationEngine();
      const execution = await engine.submit([
        { id: "task-codex", agent: "codex", prompt: "build scoring engine" },
        { id: "task-db", agent: "db", prompt: "design event store", dependsOn: ["task-codex"] },
      ]);
      const replay = replayOrchestrationExecution(execution.execution_id, execution.events);
      assertEqual(replay.execution_status, "completed", "Execution should be completed");
      assertEqual(replay.task_states["task-codex"], "COMPLETED", "Codex task should be completed");
      assertEqual(replay.task_states["task-db"], "COMPLETED", "DB task should be completed");
      assertEqual(replay.is_consistent, true, "Replay should be consistent");
    },
  },
  {
    name: "TASK_STARTED without TASK_CREATED is detected",
    run: () => {
      const replay = replayOrchestrationExecution("test-execution", [
        event(0, "TASK_STARTED", "task-codex"),
        event(1, "EXECUTION_COMPLETED"),
      ]);
      assertEqual(replay.is_consistent, false, "Replay should be inconsistent");
      assertTrue(replay.consistency_errors.some((error) => error.includes("task_started_before_created")), "Missing TASK_CREATED should be reported");
    },
  },
  {
    name: "task double terminal state is detected",
    run: () => {
      const replay = replayOrchestrationExecution("test-execution", [
        event(0, "TASK_CREATED", "task-codex"),
        event(1, "TASK_STARTED", "task-codex"),
        event(2, "TASK_COMPLETED", "task-codex"),
        event(3, "TASK_FAILED", "task-codex"),
        event(4, "EXECUTION_COMPLETED"),
      ]);
      assertEqual(replay.is_consistent, false, "Replay should be inconsistent");
      assertTrue(replay.consistency_errors.some((error) => error.includes("task_has_completed_and_failed")), "Double terminal should be reported");
    },
  },
  {
    name: "execution without EXECUTION_COMPLETED is incomplete",
    run: () => {
      const replay = replayOrchestrationExecution("test-execution", [
        event(0, "TASK_CREATED", "task-codex"),
        event(1, "TASK_STARTED", "task-codex"),
        event(2, "TASK_COMPLETED", "task-codex"),
      ]);
      assertEqual(replay.execution_status, "incomplete", "Execution should be incomplete");
      assertEqual(replay.is_consistent, true, "Missing EXECUTION_COMPLETED is incomplete, not invalid");
    },
  },
  {
    name: "sequence_index disorder is detected",
    run: () => {
      const replay = replayOrchestrationExecution("test-execution", [
        event(0, "TASK_CREATED", "task-codex"),
        event(2, "TASK_STARTED", "task-codex"),
        event(1, "TASK_COMPLETED", "task-codex"),
        event(3, "EXECUTION_COMPLETED"),
      ]);
      assertEqual(replay.is_consistent, false, "Replay should be inconsistent");
      assertTrue(replay.consistency_errors.some((error) => error.includes("non_increasing_sequence_index")), "Sequence disorder should be reported");
    },
  },
  {
    name: "replay does not re-run agent execution",
    run: () => {
      const events = [
        event(0, "TASK_CREATED", "task-codex"),
        event(1, "TASK_STARTED", "task-codex"),
        event(2, "TASK_COMPLETED", "task-codex"),
        event(3, "EXECUTION_COMPLETED"),
      ];
      let taskExecutedLogs = 0;
      const originalLog = console.log;
      console.log = (...args) => {
        if (String(args.join(" ")).includes("task executed")) {
          taskExecutedLogs += 1;
        }
      };
      try {
        replayOrchestrationExecution("test-execution", events);
      } finally {
        console.log = originalLog;
      }
      assertEqual(taskExecutedLogs, 0, "Replay should not execute tasks or agents");
    },
  },
  {
    name: "normal demo replay is_consistent=true",
    run: async () => {
      const engine = new OrchestrationEngine();
      const execution = await engine.submit([
        { id: "task-codex-demo", agent: "codex", prompt: "build scoring engine" },
        { id: "task-db-demo", agent: "db", prompt: "design event store", dependsOn: ["task-codex-demo"] },
      ]);
      const replay = replayOrchestrationExecution(execution.execution_id, execution.events);
      assertEqual(replay.is_consistent, true, "Normal demo replay should be consistent");
      assertEqual(replay.execution_status, "completed", "Normal demo replay should be completed");
    },
  },
];

async function main() {
  for (const test of tests) {
    try {
      await test.run();
      console.log(`PASS ${test.name}`);
    } catch (error) {
      console.error(`FAIL ${test.name}`);
      console.error(error && error.message ? error.message : error);
      process.exitCode = 1;
    }
  }
}

main();
