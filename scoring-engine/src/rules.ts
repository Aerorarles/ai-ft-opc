// @ts-check

const { normalizeText } = require("./features.ts");

const VALID_FIELDS = new Set([
  "company_name",
  "website",
  "country",
  "industry",
  "email",
  "phone",
  "signals",
  "has_email",
  "has_phone",
  "industry_keywords",
]);

const VALID_OPERATORS = new Set(["contains", "in", "equals", "exists"]);
const VALID_RULE_TYPES = new Set(["keyword", "country", "industry", "signal", "risk", "contact"]);

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(normalizeText).filter(Boolean);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isScalarValue(value) {
  return typeof value === "string" || typeof value === "boolean" || typeof value === "number";
}

/**
 * @param {import("./types.ts").ScoringRule} rule
 * @returns {import("./types.ts").EvaluationWarning[]}
 */
function validateRule(rule) {
  const warnings = [];
  const ruleId = rule && rule.id ? String(rule.id) : "unknown-rule";

  if (!rule || typeof rule !== "object") {
    return [{
      rule_id: ruleId,
      code: "invalid_rule",
      message: "Rule must be an object.",
    }];
  }

  if (!VALID_RULE_TYPES.has(rule.rule_type)) {
    warnings.push({
      rule_id: ruleId,
      code: "unknown_rule_type",
      message: `Rule type is not supported: ${String(rule.rule_type)}`,
    });
  }

  if (!rule.field) {
    warnings.push({
      rule_id: ruleId,
      code: "missing_field",
      message: "Rule field is required.",
    });
  } else if (!VALID_FIELDS.has(rule.field)) {
    warnings.push({
      rule_id: ruleId,
      code: "unknown_field",
      message: `Rule field is not supported: ${String(rule.field)}`,
    });
  }

  if (!VALID_OPERATORS.has(rule.operator)) {
    warnings.push({
      rule_id: ruleId,
      code: "unknown_operator",
      message: `Rule operator is not supported: ${String(rule.operator)}`,
    });
  }

  if (rule.operator === "in" && !Array.isArray(rule.value)) {
    warnings.push({
      rule_id: ruleId,
      code: "invalid_value_type",
      message: "Operator in requires rule.value to be an array.",
    });
  }

  if ((rule.operator === "contains" || rule.operator === "equals") && !isScalarValue(rule.value)) {
    warnings.push({
      rule_id: ruleId,
      code: "invalid_value_type",
      message: `Operator ${String(rule.operator)} requires a scalar rule.value.`,
    });
  }

  return warnings;
}

/**
 * @param {import("./types.ts").RuleField} field
 * @param {import("./types.ts").LeadFeatures} features
 * @returns {string | boolean | string[] | null}
 */
function getFeatureValue(field, features) {
  return features[field];
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function valueExists(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return normalizeText(value).length > 0;
}

/**
 * @param {string | boolean | string[] | null} featureValue
 * @param {unknown} expectedValue
 * @returns {boolean}
 */
function matchContains(featureValue, expectedValue) {
  if (!isScalarValue(expectedValue)) {
    return false;
  }

  const expected = normalizeText(expectedValue);
  if (!expected) {
    return false;
  }

  if (Array.isArray(featureValue)) {
    return featureValue.some((item) => normalizeText(item).includes(expected));
  }

  if (typeof featureValue === "boolean") {
    return false;
  }

  return normalizeText(featureValue).includes(expected);
}

/**
 * @param {string | boolean | string[] | null} featureValue
 * @param {unknown} expectedValue
 * @returns {boolean}
 */
function matchIn(featureValue, expectedValue) {
  const expected = normalizeArray(expectedValue);
  if (expected.length === 0) {
    return false;
  }

  if (Array.isArray(featureValue)) {
    return featureValue.some((item) => expected.includes(normalizeText(item)));
  }

  return expected.includes(normalizeText(featureValue));
}

/**
 * @param {string | boolean | string[] | null} featureValue
 * @param {unknown} expectedValue
 * @returns {boolean}
 */
function matchEquals(featureValue, expectedValue) {
  if (!isScalarValue(expectedValue)) {
    return false;
  }

  const expected = normalizeText(expectedValue);
  if (Array.isArray(featureValue)) {
    return featureValue.some((item) => normalizeText(item) === expected);
  }

  return normalizeText(featureValue) === expected;
}

/**
 * @param {import("./types.ts").ScoringRule} rule
 * @param {import("./types.ts").LeadFeatures} features
 * @returns {{ matched: boolean, warnings: import("./types.ts").EvaluationWarning[] }}
 */
function evaluateRule(rule, features) {
  const warnings = validateRule(rule);
  if (warnings.length > 0) {
    return { matched: false, warnings };
  }

  const featureValue = getFeatureValue(rule.field, features);

  switch (rule.operator) {
    case "exists":
      return { matched: valueExists(featureValue), warnings: [] };
    case "contains":
      return { matched: matchContains(featureValue, rule.value), warnings: [] };
    case "in":
      return { matched: matchIn(featureValue, rule.value), warnings: [] };
    case "equals":
      return { matched: matchEquals(featureValue, rule.value), warnings: [] };
    default:
      return { matched: false, warnings: [] };
  }
}

/**
 * @param {import("./types.ts").ScoringRule} rule
 * @returns {number}
 */
function getRulePriority(rule) {
  return typeof rule.priority === "number" && Number.isFinite(rule.priority) ? rule.priority : 0;
}

/**
 * @param {import("./types.ts").ScoringRule} rule
 * @returns {boolean}
 */
function isBlockingRule(rule) {
  return rule.blocking === true;
}

/**
 * @param {import("./types.ts").ScoringRule} rule
 * @returns {string | null}
 */
function getOverrideGroup(rule) {
  return typeof rule.override_group === "string" && rule.override_group.trim()
    ? rule.override_group.trim()
    : null;
}

/**
 * @param {import("./types.ts").EvaluationWarning[]} warnings
 * @returns {"invalid_field" | "invalid_operator" | null}
 */
function getInvalidSkipReason(warnings) {
  if (warnings.some((warning) => warning.code === "unknown_field" || warning.code === "missing_field")) {
    return "invalid_field";
  }
  if (warnings.some((warning) => warning.code === "unknown_operator")) {
    return "invalid_operator";
  }
  return null;
}

/**
 * @param {import("./types.ts").ScoringRule} rule
 * @param {"blocked_rule" | "overridden" | "lower_priority" | "invalid_field" | "invalid_operator"} reason
 * @returns {import("./types.ts").SkippedRule}
 */
function toSkippedRule(rule, reason) {
  return {
    rule_id: rule && rule.id ? rule.id : "unknown-rule",
    rule_type: rule ? rule.rule_type : undefined,
    field: rule ? rule.field : undefined,
    operator: rule ? rule.operator : undefined,
    dimension: rule ? rule.dimension : undefined,
    priority: rule ? getRulePriority(rule) : 0,
    override_group: rule ? getOverrideGroup(rule) : null,
    skipped_reason: reason,
  };
}

/**
 * Evaluate rules using v0.3 precedence semantics.
 *
 * @param {import("./types.ts").ScoringRule[]} rules
 * @param {import("./types.ts").LeadFeatures} features
 * @returns {{
 *   matched_rules: import("./types.ts").ScoringRule[],
 *   evaluated_rules: Array<{ rule: import("./types.ts").ScoringRule, matched: boolean }>,
 *   skipped_rules: import("./types.ts").SkippedRule[],
 *   blocked_dimensions: import("./types.ts").ScoreDimension[],
 *   override_applied_rule_ids: string[],
 *   override_groups: Array<{ override_group: string, selected_rule_id: string, skipped_rule_ids: string[] }>,
 *   evaluation_warnings: import("./types.ts").EvaluationWarning[]
 * }}
 */
function evaluateRulesWithPrecedence(rules, features) {
  const sortedRules = rules
    .map((rule, index) => ({ rule, index }))
    .sort((left, right) => {
      const priorityDiff = getRulePriority(right.rule) - getRulePriority(left.rule);
      return priorityDiff !== 0 ? priorityDiff : left.index - right.index;
    });

  /** @type {Map<string, import("./types.ts").ScoringRule>} */
  const overrideWinners = new Map();
  /** @type {Map<string, "overridden" | "lower_priority">} */
  const overrideSkippedReasons = new Map();
  /** @type {Map<string, string[]>} */
  const overrideSkippedRuleIdsByGroup = new Map();

  for (const item of sortedRules) {
    const group = getOverrideGroup(item.rule);
    if (!group) {
      continue;
    }
    const winner = overrideWinners.get(group);
    if (!winner) {
      overrideWinners.set(group, item.rule);
      continue;
    }
    const reason = getRulePriority(item.rule) < getRulePriority(winner) ? "lower_priority" : "overridden";
    overrideSkippedReasons.set(item.rule.id, reason);
    if (!overrideSkippedRuleIdsByGroup.has(group)) {
      overrideSkippedRuleIdsByGroup.set(group, []);
    }
    overrideSkippedRuleIdsByGroup.get(group).push(item.rule.id);
  }

  /** @type {import("./types.ts").ScoringRule[]} */
  const matchedRules = [];
  /** @type {Array<{ rule: import("./types.ts").ScoringRule, matched: boolean }>} */
  const evaluatedRules = [];
  /** @type {import("./types.ts").SkippedRule[]} */
  const skippedRules = [];
  /** @type {Set<import("./types.ts").ScoreDimension>} */
  const blockedDimensions = new Set();
  /** @type {string[]} */
  const overrideAppliedRuleIds = [];
  /** @type {import("./types.ts").EvaluationWarning[]} */
  const evaluationWarnings = [];

  for (const item of sortedRules) {
    const rule = item.rule;
    const overrideSkipReason = overrideSkippedReasons.get(rule.id);
    if (overrideSkipReason) {
      skippedRules.push(toSkippedRule(rule, overrideSkipReason));
      continue;
    }

    if (rule.dimension && blockedDimensions.has(rule.dimension)) {
      skippedRules.push(toSkippedRule(rule, "blocked_rule"));
      continue;
    }

    const evaluation = evaluateRule(rule, features);
    if (evaluation.warnings.length > 0) {
      evaluationWarnings.push(...evaluation.warnings);
      const invalidReason = getInvalidSkipReason(evaluation.warnings);
      if (invalidReason) {
        skippedRules.push(toSkippedRule(rule, invalidReason));
      }
      continue;
    }

    if (!evaluation.matched) {
      evaluatedRules.push({ rule, matched: false });
      continue;
    }

    evaluatedRules.push({ rule, matched: true });
    matchedRules.push(rule);

    if (getOverrideGroup(rule)) {
      overrideAppliedRuleIds.push(rule.id);
    }

    if (isBlockingRule(rule) && rule.dimension) {
      blockedDimensions.add(rule.dimension);
    }
  }

  return {
    matched_rules: matchedRules,
    evaluated_rules: evaluatedRules,
    skipped_rules: skippedRules,
    blocked_dimensions: Array.from(blockedDimensions),
    override_applied_rule_ids: overrideAppliedRuleIds,
    override_groups: Array.from(overrideWinners.entries())
      .filter(([group]) => (overrideSkippedRuleIdsByGroup.get(group) || []).length > 0)
      .map(([group, selectedRule]) => ({
        override_group: group,
        selected_rule_id: selectedRule.id,
        skipped_rule_ids: overrideSkippedRuleIdsByGroup.get(group) || [],
      })),
    evaluation_warnings: evaluationWarnings,
  };
}

module.exports = {
  evaluateRule,
  evaluateRulesWithPrecedence,
  validateRule,
  getFeatureValue,
  getRulePriority,
  isBlockingRule,
  getOverrideGroup,
  VALID_FIELDS,
  VALID_OPERATORS,
  VALID_RULE_TYPES,
};
