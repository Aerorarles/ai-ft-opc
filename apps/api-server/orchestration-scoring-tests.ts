const {
  OrchestrationEngine,
  replayOrchestrationExecution,
} = require("../../packages/orchestration/src/index.ts");
const invalidScoringConfigJson = require("../../scoring-config/v1-invalid.json");

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

function assertDoesNotContain(value, patterns, message) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const pattern of patterns) {
    if (serialized.includes(pattern.toLowerCase())) {
      throw new Error(`${message}. Found forbidden pattern: ${pattern}`);
    }
  }
}

const baseLead = {
  company_name: "ABC Displays",
  country: "US",
  industry: "Retail Display Manufacturing",
  email: "info@example.test",
  phone: "+1 555 123 4567",
  signals: ["factory", "export", "display"],
};

async function runScoringExecution(extraTaskFields = undefined) {
  const engine = new OrchestrationEngine();
  return engine.submit([
    {
      id: "task-score-lead",
      agent: "scoring",
      task_kind: "lead_scoring",
      lead: baseLead,
      tenant_id: "local",
      config_version_id: "v1",
      run_mode: "preview",
      request_trace_id: "orchestration-scoring-test",
      idempotency_key: "orchestration-scoring-test-lead",
      ...(extraTaskFields || {}),
    },
  ]);
}

const tests = [
  {
    name: "lead_scoring task runs through DAG scheduler",
    run: async () => {
      const execution = await runScoringExecution();
      assertEqual(execution.results.length, 1, "One scoring task should complete");
      assertEqual(execution.results[0].task_kind, "lead_scoring", "Result should identify lead scoring task kind");
      assertEqual(execution.final_state.completed, true, "Execution final state should be completed");
    },
  },
  {
    name: "demo scoring input keeps expected total_score 21",
    run: async () => {
      const execution = await runScoringExecution();
      assertEqual(execution.results[0].total_score, 21, "Integrated scoring total should remain 21");
    },
  },
  {
    name: "TASK_COMPLETED result includes sanitized scoring summary",
    run: async () => {
      const execution = await runScoringExecution();
      const completedEvent = execution.events.find((event) => event.type === "TASK_COMPLETED" && event.task_id === "task-score-lead");
      assertTrue(Boolean(completedEvent), "TASK_COMPLETED event should exist");
      assertEqual(completedEvent.result.total_score, 21, "Result should include total_score");
      assertTrue(Boolean(completedEvent.result.breakdown), "Result should include breakdown");
      assertEqual(completedEvent.result.applied_rule_count, 4, "Result should include applied rule count");
    },
  },
  {
    name: "TASK_COMPLETED result excludes raw sensitive fields",
    run: async () => {
      const execution = await runScoringExecution();
      const completedEvent = execution.events.find((event) => event.type === "TASK_COMPLETED" && event.task_id === "task-score-lead");
      assertDoesNotContain(completedEvent.result, [
        "info@example.test",
        "+1 555 123 4567",
        "html",
        "headers",
        "cookies",
        "cookie",
        "secret",
        "password",
        "authorization",
        "event_type",
        "rule_execution_path",
      ], "TASK_COMPLETED result should remain sanitized");
    },
  },
  {
    name: "orchestration replay does not call scoring again",
    run: async () => {
      const execution = await runScoringExecution();
      let scoringLogs = 0;
      const originalLog = console.log;
      console.log = (...args) => {
        if (String(args.join(" ")).includes("task executed")) {
          scoringLogs += 1;
        }
      };
      try {
        replayOrchestrationExecution(execution.execution_id, execution.events);
      } finally {
        console.log = originalLog;
      }
      assertEqual(scoringLogs, 0, "Replay should not execute scoring facade or tasks");
    },
  },
  {
    name: "scoring result replay_consistency is true",
    run: async () => {
      const execution = await runScoringExecution();
      assertEqual(execution.results[0].replay_consistency, true, "Scoring replay consistency should be true");
    },
  },
  {
    name: "mock task does not trigger lead scoring",
    run: async () => {
      const engine = new OrchestrationEngine();
      const execution = await engine.submit([
        {
          id: "task-mock-codex",
          agent: "codex",
          prompt: "build scoring engine",
        },
      ]);
      assertEqual(execution.results[0].state, "COMPLETED", "Mock task should complete");
      assertEqual(execution.results[0].total_score, undefined, "Mock task should not include scoring result");
      assertEqual(execution.results[0].task_kind, undefined, "Mock task should not be marked as scoring");
    },
  },
  {
    name: "invalid scoring config returns blocked result without fake success score",
    run: async () => {
      const execution = await runScoringExecution({
        config_version_id: "invalid-local",
        tenantConfigs: {
          local: {
            "invalid-local": invalidScoringConfigJson,
          },
        },
      });
      assertEqual(execution.results[0].total_score, null, "Invalid config should not produce a score");
      assertEqual(execution.results[0].scoring_blocked, true, "Invalid config should be explicitly blocked");
    },
  },
  {
    name: "orchestration replay reconstructs completed scoring task",
    run: async () => {
      const execution = await runScoringExecution();
      const replay = replayOrchestrationExecution(execution.execution_id, execution.events);
      assertEqual(replay.is_consistent, true, "Orchestration replay should be consistent");
      assertEqual(replay.task_states["task-score-lead"], "COMPLETED", "Replay should reconstruct scoring task completion");
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
