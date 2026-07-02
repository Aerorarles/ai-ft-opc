const { replayOrchestrationExecution } = require("./replay.ts");

function auditOrchestrationExecution(executionId, events, originalSummary) {
  const replay = replayOrchestrationExecution(executionId, events);
  const auditErrors = [...replay.consistency_errors];

  if (originalSummary && typeof originalSummary.event_count === "number" && originalSummary.event_count !== replay.event_count) {
    auditErrors.push(`event_count_summary_mismatch:${originalSummary.event_count}:${replay.event_count}`);
  }

  if (originalSummary && originalSummary.execution_status && originalSummary.execution_status !== replay.execution_status) {
    auditErrors.push(`execution_status_summary_mismatch:${originalSummary.execution_status}:${replay.execution_status}`);
  }

  return {
    ...replay,
    audit_errors: auditErrors,
    audit_passed: auditErrors.length === 0,
  };
}

module.exports = {
  auditOrchestrationExecution,
};
