// @ts-check

const { scoreLeadAPI } = require("../../../scoring-engine/src/api/scoring-service.ts");

/**
 * @typedef {{
 *   id: string,
 *   task_kind?: string,
 *   lead?: import("../../../scoring-engine/src/types.ts").Lead,
 *   tenant_id?: string,
 *   config_version_id?: string,
 *   run_mode?: import("../../../scoring-engine/src/types.ts").RunMode,
 *   request_trace_id?: string,
 *   idempotency_key?: string,
 *   tenantConfigs?: Record<string, Record<string, unknown>>
 * }} LeadScoringTaskInput
 */

/**
 * @typedef {{
 *   taskId: string,
 *   state: "COMPLETED",
 *   task_kind: "lead_scoring",
 *   execution_id: string,
 *   scoring_execution_id: string,
 *   total_score: number | null,
 *   breakdown: import("../../../scoring-engine/src/types.ts").ScoreBreakdown,
 *   applied_rule_count: number,
 *   scoring_run_mode: import("../../../scoring-engine/src/types.ts").RunMode,
 *   replay_consistency: boolean,
 *   inconsistency_type: string,
 *   config_version_id: string,
 *   tenant_id: string,
 *   scoring_blocked: boolean
 * }} LeadScoringTaskSummary
 */

/**
 * Executes one local lead scoring task and returns only a sanitized summary.
 * The orchestration event result must not include raw lead fields, full
 * scoring explanations, event streams, headers, cookies, HTML, or secrets.
 *
 * @param {LeadScoringTaskInput} task
 * @returns {LeadScoringTaskSummary}
 */
function executeLeadScoringTask(task) {
  if (!task.lead) {
    throw new Error("lead_scoring_task_missing_lead");
  }

  const tenantId = task.tenant_id || "local";
  const configVersionId = task.config_version_id || "v1";
  const runMode = task.run_mode || "preview";
  const requestTraceId = task.request_trace_id || `orchestration-task:${task.id}`;

  const response = scoreLeadAPI({
    lead: task.lead,
    tenant_id: tenantId,
    config_version_id: configVersionId,
    run_mode: runMode,
    request_trace_id: requestTraceId,
    idempotency_key: task.idempotency_key,
  }, task.tenantConfigs ? { tenantConfigs: task.tenantConfigs } : undefined);

  return {
    taskId: task.id,
    state: "COMPLETED",
    task_kind: "lead_scoring",
    execution_id: response.execution_id,
    scoring_execution_id: response.execution_id,
    total_score: response.total_score,
    breakdown: response.breakdown,
    applied_rule_count: response.applied_rules.length,
    scoring_run_mode: runMode,
    replay_consistency: response.replay_metadata.is_consistent === true,
    inconsistency_type: String(response.replay_metadata.inconsistency_type || "NONE"),
    config_version_id: configVersionId,
    tenant_id: tenantId,
    scoring_blocked: response.total_score === null,
  };
}

module.exports = {
  executeLeadScoringTask,
};
