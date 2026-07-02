const { EventEmitter } = require("./event-emitter.ts");
const { Scheduler } = require("./scheduler.ts");
const { TaskGraphBuilder } = require("./task-graph.ts");

/**
 * @typedef {{
 *   id: string,
 *   agent: string,
 *   prompt?: string,
 *   dependsOn?: string[],
 *   task_kind?: "mock" | "lead_scoring",
 *   lead?: import("../../../scoring-engine/src/types.ts").Lead,
 *   tenant_id?: string,
 *   config_version_id?: string,
 *   run_mode?: import("../../../scoring-engine/src/types.ts").RunMode,
 *   request_trace_id?: string,
 *   idempotency_key?: string,
 *   tenantConfigs?: Record<string, Record<string, unknown>>
 * }} OrchestrationTaskInput
 */

class OrchestrationEngine {
  /** @type {{ build(tasks: OrchestrationTaskInput[]): Map<string, Record<string, any>> }} */
  graphBuilder;

  constructor() {
    this.graphBuilder = new TaskGraphBuilder();
  }

  /**
   * @param {OrchestrationTaskInput[]} tasks
   */
  async submit(tasks) {
    const executionId = this.createExecutionId();
    const eventEmitter = new EventEmitter();
    const scheduler = new Scheduler(eventEmitter, executionId);

    console.log("✔ orchestration started");
    const graph = this.graphBuilder.build(tasks);

    for (const task of graph.values()) {
      eventEmitter.emit({
        type: "TASK_CREATED",
        execution_id: executionId,
        task_id: task.id,
        agent_type: task.agent,
      });
    }

    const results = await scheduler.run(graph);
    eventEmitter.emit({
      type: "EXECUTION_COMPLETED",
      execution_id: executionId,
    });
    console.log("✔ orchestration complete");

    return {
      execution_id: executionId,
      results,
      events: eventEmitter.getEvents(),
      final_state: this.replayEvents(eventEmitter.getEvents()),
    };
  }

  /**
   * @param {Array<Record<string, any>>} events
   */
  replayEvents(events) {
    const state = {
      execution_id: null,
      tasks: {},
      completed: false,
    };

    for (const event of events) {
      state.execution_id = event.execution_id;

      if (event.task_id) {
        state.tasks[event.task_id] = {
          ...(state.tasks[event.task_id] || {}),
          task_id: event.task_id,
          agent_type: event.agent_type,
          last_event: event.type,
          result: event.result,
          error: event.error,
        };
      }

      if (event.type === "EXECUTION_COMPLETED") {
        state.completed = true;
      }
    }

    return state;
  }

  /**
   * @returns {string}
   */
  createExecutionId() {
    return `orch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

module.exports = {
  OrchestrationEngine,
};
