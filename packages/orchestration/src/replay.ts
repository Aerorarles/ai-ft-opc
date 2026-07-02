const VALID_TASK_STATES = new Set(["PENDING", "READY", "RUNNING", "COMPLETED", "FAILED", "SKIPPED"]);

function emptyReplayResult(executionId, errors) {
  return {
    execution_id: executionId,
    execution_status: "invalid",
    task_states: {},
    task_order: [],
    event_count: 0,
    started_task_ids: [],
    completed_task_ids: [],
    failed_task_ids: [],
    consistency_errors: errors,
    is_consistent: false,
    replay_summary: "No orchestration events were available for replay.",
  };
}

function replayOrchestrationExecution(executionId, events) {
  if (!Array.isArray(events) || events.length === 0) {
    return emptyReplayResult(executionId, ["empty_event_stream"]);
  }

  const consistencyErrors = [];
  const taskStates = {};
  const taskTerminals = {};
  const startedTaskIds = new Set();
  const completedTaskIds = new Set();
  const failedTaskIds = new Set();
  const createdTaskIds = new Set();
  const seenSequenceIndexes = new Set();
  const taskOrder = [];
  let lastSequenceIndex = -1;
  let hasExecutionCompleted = false;

  for (const event of events) {
    if (event.execution_id !== executionId) {
      consistencyErrors.push(`mixed_execution_event:${event.execution_id || "missing_execution_id"}`);
    }

    if (typeof event.sequence_index !== "number") {
      consistencyErrors.push(`missing_sequence_index:${event.type}:${event.task_id || "execution"}`);
    } else {
      if (seenSequenceIndexes.has(event.sequence_index)) {
        consistencyErrors.push(`duplicate_sequence_index:${event.sequence_index}`);
      }
      if (event.sequence_index <= lastSequenceIndex) {
        consistencyErrors.push(`non_increasing_sequence_index:${event.sequence_index}`);
      }
      seenSequenceIndexes.add(event.sequence_index);
      lastSequenceIndex = event.sequence_index;
    }

    taskOrder.push({
      sequence_index: event.sequence_index,
      type: event.type,
      task_id: event.task_id || null,
    });

    if (event.type === "EXECUTION_COMPLETED") {
      hasExecutionCompleted = true;
      for (const [taskId, state] of Object.entries(taskStates)) {
        if (state === "PENDING" || state === "READY" || state === "RUNNING") {
          consistencyErrors.push(`execution_completed_before_task_terminal:${taskId}:${state}`);
        }
      }
      continue;
    }

    const taskId = event.task_id;
    if (!taskId) {
      consistencyErrors.push(`task_event_missing_task_id:${event.type}`);
      continue;
    }

    if (!taskStates[taskId]) {
      taskStates[taskId] = "PENDING";
    }

    if (event.type === "TASK_CREATED") {
      if (createdTaskIds.has(taskId)) {
        consistencyErrors.push(`duplicate_task_created:${taskId}`);
      }
      createdTaskIds.add(taskId);
      taskStates[taskId] = "PENDING";
      continue;
    }

    if (!createdTaskIds.has(taskId)) {
      consistencyErrors.push(`missing_task_created:${taskId}`);
    }

    if (event.type === "TASK_READY") {
      taskStates[taskId] = "READY";
      continue;
    }

    if (event.type === "TASK_STARTED") {
      if (!createdTaskIds.has(taskId)) {
        consistencyErrors.push(`task_started_before_created:${taskId}`);
      }
      startedTaskIds.add(taskId);
      taskStates[taskId] = "RUNNING";
      continue;
    }

    if (event.type === "TASK_COMPLETED") {
      if (!startedTaskIds.has(taskId)) {
        consistencyErrors.push(`task_completed_before_started:${taskId}`);
      }
      if (completedTaskIds.has(taskId)) {
        consistencyErrors.push(`duplicate_task_completed:${taskId}`);
      }
      if (taskTerminals[taskId] === "FAILED") {
        consistencyErrors.push(`task_has_completed_and_failed:${taskId}`);
      }
      taskTerminals[taskId] = "COMPLETED";
      completedTaskIds.add(taskId);
      taskStates[taskId] = "COMPLETED";
      continue;
    }

    if (event.type === "TASK_FAILED") {
      if (!startedTaskIds.has(taskId)) {
        consistencyErrors.push(`task_failed_before_started:${taskId}`);
      }
      if (taskTerminals[taskId] === "COMPLETED") {
        consistencyErrors.push(`task_has_completed_and_failed:${taskId}`);
      }
      taskTerminals[taskId] = "FAILED";
      failedTaskIds.add(taskId);
      taskStates[taskId] = "FAILED";
      continue;
    }

    consistencyErrors.push(`unknown_event_type:${event.type}`);
  }

  let executionStatus = "incomplete";
  if (consistencyErrors.length > 0) {
    executionStatus = "invalid";
  } else if (failedTaskIds.size > 0) {
    executionStatus = "failed";
  } else if (hasExecutionCompleted) {
    executionStatus = "completed";
  }

  const isConsistent = consistencyErrors.length === 0;

  return {
    execution_id: executionId,
    execution_status: executionStatus,
    task_states: taskStates,
    task_order: [...taskOrder].sort((left, right) => {
      const leftIndex = typeof left.sequence_index === "number" ? left.sequence_index : Number.MAX_SAFE_INTEGER;
      const rightIndex = typeof right.sequence_index === "number" ? right.sequence_index : Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex;
    }),
    event_count: events.length,
    started_task_ids: Array.from(startedTaskIds),
    completed_task_ids: Array.from(completedTaskIds),
    failed_task_ids: Array.from(failedTaskIds),
    consistency_errors: consistencyErrors,
    is_consistent: isConsistent,
    replay_summary: isConsistent
      ? `Replayed ${events.length} orchestration events for ${Object.keys(taskStates).length} tasks.`
      : `Replay found ${consistencyErrors.length} consistency issue(s).`,
  };
}

module.exports = {
  replayOrchestrationExecution,
  VALID_TASK_STATES,
};
