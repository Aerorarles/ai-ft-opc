const { executeLeadScoringTask } = require("./lead-scoring-adapter.ts");

/**
 * @typedef {{
 *   id: string,
 *   agent: string,
 *   prompt?: string,
 *   dependsOn: string[],
 *   state: string,
 *   task_kind?: "mock" | "lead_scoring",
 *   lead?: import("../../../scoring-engine/src/types.ts").Lead,
 *   tenant_id?: string,
 *   config_version_id?: string,
 *   run_mode?: import("../../../scoring-engine/src/types.ts").RunMode,
 *   request_trace_id?: string,
 *   idempotency_key?: string,
 *   tenantConfigs?: Record<string, Record<string, unknown>>
 * }} OrchestrationTaskNode
 */

class Scheduler {
  /** @type {{ emit(event: Record<string, unknown>): void }} */
  eventEmitter;

  /** @type {string} */
  executionId;

  /**
   * @param {{ emit(event: Record<string, unknown>): void }} eventEmitter
   * @param {string} executionId
   */
  constructor(eventEmitter, executionId) {
    this.eventEmitter = eventEmitter;
    this.executionId = executionId;
  }

  /**
   * @param {Map<string, OrchestrationTaskNode>} graph
   * @returns {Promise<Array<Record<string, unknown>>>}
   */
  async run(graph) {
    const results = [];

    while (this.hasIncompleteTasks(graph)) {
      const readyTasks = this.getReadyTasks(graph);
      if (readyTasks.length === 0) {
        throw new Error("No READY tasks available. Dependency resolution is blocked.");
      }

      for (const task of readyTasks) {
        try {
          this.transition(task, "RUNNING");
          const result = await this.executeTask(task);
          console.log(`✔ task executed (${task.agent})`);
          this.transition(task, "COMPLETED", result);
          results.push(result);
        } catch (error) {
          this.transition(task, "FAILED", null, error && error.message ? error.message : String(error));
          throw error;
        }
      }
    }

    return results;
  }

  /**
   * @param {OrchestrationTaskNode} task
   * @returns {Promise<Record<string, unknown>>}
   */
  async executeTask(task) {
    if (task.task_kind === "lead_scoring") {
      return executeLeadScoringTask(task);
    }

    return {
      taskId: task.id,
      agent: task.agent,
      prompt: task.prompt,
      state: "COMPLETED",
    };
  }

  /**
   * @param {OrchestrationTaskNode} task
   * @param {string} nextState
   * @param {Record<string, unknown> | null=} result
   * @param {string=} error
   */
  transition(task, nextState, result = null, error = undefined) {
    task.state = nextState;

    if (nextState === "READY") {
      this.eventEmitter.emit({
        type: "TASK_READY",
        execution_id: this.executionId,
        task_id: task.id,
        agent_type: task.agent,
      });
      return;
    }

    if (nextState === "RUNNING") {
      this.eventEmitter.emit({
        type: "TASK_STARTED",
        execution_id: this.executionId,
        task_id: task.id,
        agent_type: task.agent,
      });
      return;
    }

    if (nextState === "COMPLETED") {
      this.eventEmitter.emit({
        type: "TASK_COMPLETED",
        execution_id: this.executionId,
        task_id: task.id,
        agent_type: task.agent,
        result,
      });
      return;
    }

    if (nextState === "FAILED") {
      this.eventEmitter.emit({
        type: "TASK_FAILED",
        execution_id: this.executionId,
        task_id: task.id,
        agent_type: task.agent,
        error: error || "unknown_error",
      });
    }
  }

  /**
   * @param {Map<string, OrchestrationTaskNode>} graph
   * @returns {OrchestrationTaskNode[]}
   */
  getReadyTasks(graph) {
    const readyTasks = [];

    for (const task of graph.values()) {
      if (task.state !== "PENDING") {
        continue;
      }

      const dependenciesComplete = task.dependsOn.every((dependencyId) => {
        const dependency = graph.get(dependencyId);
        return dependency && dependency.state === "COMPLETED";
      });

      if (dependenciesComplete) {
        this.transition(task, "READY");
        readyTasks.push(task);
      }
    }

    return readyTasks;
  }

  /**
   * @param {Map<string, OrchestrationTaskNode>} graph
   * @returns {boolean}
   */
  hasIncompleteTasks(graph) {
    for (const task of graph.values()) {
      if (task.state !== "COMPLETED") {
        return true;
      }
    }
    return false;
  }
}

module.exports = {
  Scheduler,
};
