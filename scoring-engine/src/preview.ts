// @ts-check

const { loadConfig } = require("./config.ts");
const { scoreLead } = require("./engine.ts");

const RULE_LABELS = {
  "keyword-display": "目标行业",
  "country-target-markets": "目标国家",
  "contact-email-exists": "公开邮箱",
  "signal-factory": "工厂信号",
  "risk-wordpress": "WordPress 风险",
};

/**
 * @param {number} value
 * @returns {string}
 */
function formatSignedDelta(value) {
  return value >= 0 ? `+${value}` : String(value);
}

/**
 * @param {import("./types.ts").AppliedRule[]} appliedRules
 * @returns {{ total_effective_delta: number, by_dimension: import("./types.ts").ScoreBreakdown }}
 */
function buildDeltaSummary(appliedRules) {
  const byDimension = {
    relevance: 0,
    trust: 0,
    capability: 0,
    risk: 0,
  };

  for (const rule of appliedRules) {
    byDimension[rule.dimension] += rule.effective_delta;
  }

  return {
    total_effective_delta: appliedRules.reduce((sum, rule) => sum + rule.effective_delta, 0),
    by_dimension: byDimension,
  };
}

/**
 * @param {import("./types.ts").ScoreResult} scoreResult
 * @returns {string}
 */
function buildHumanReadableSummary(scoreResult) {
  if (scoreResult.total_score === null) {
    return `配置校验未通过，发现 ${scoreResult.validation_errors.length} 个错误；未计算正式评分。`;
  }

  if (scoreResult.applied_rules.length === 0) {
    return `该 Lead 未命中任何规则；按当前权重计算总分为 ${scoreResult.total_score}。`;
  }

  const ruleSummaries = scoreResult.applied_rules.map((rule) => {
    const label = RULE_LABELS[rule.rule_id] || rule.rule_id;
    return `${label} ${formatSignedDelta(rule.effective_delta)}`;
  });

  return `该 Lead 命中 ${scoreResult.applied_rules.length} 条规则：${ruleSummaries.join("、")}；按当前权重计算总分为 ${scoreResult.total_score}。`;
}

/**
 * @param {import("./types.ts").Lead} lead
 * @param {unknown} configJson
 * @returns {{
 *   config_version: string | null,
 *   config_metadata: import("./types.ts").ScoringConfigMetadata | undefined,
 *   is_config_valid: boolean,
 *   validation_errors: import("./types.ts").ConfigValidationIssue[],
 *   validation_warnings: import("./types.ts").ConfigValidationIssue[],
 *   score_result: import("./types.ts").ScoreResult,
 *   score_delta_summary: { total_effective_delta: number, by_dimension: import("./types.ts").ScoreBreakdown },
 *   human_readable_summary: string
 * }}
 */
function previewLeadScore(lead, configJson) {
  const loadedConfig = loadConfig(configJson);
  const scoreResult = scoreLead(lead, loadedConfig);
  const scoreDeltaSummary = buildDeltaSummary(scoreResult.applied_rules);

  return {
    config_version: loadedConfig.config.version || null,
    config_metadata: loadedConfig.config.metadata,
    is_config_valid: loadedConfig.is_valid,
    validation_errors: loadedConfig.validation_errors,
    validation_warnings: loadedConfig.validation_warnings,
    score_result: scoreResult,
    score_delta_summary: scoreDeltaSummary,
    human_readable_summary: buildHumanReadableSummary(scoreResult),
  };
}

module.exports = {
  previewLeadScore,
  buildHumanReadableSummary,
};
