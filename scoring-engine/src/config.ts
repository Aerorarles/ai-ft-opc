// @ts-check

const { VALID_FIELDS, VALID_OPERATORS, VALID_RULE_TYPES } = require("./rules.ts");

/** @type {import("./types.ts").ScoringWeights} */
const DEFAULT_SCORING_WEIGHTS = {
  relevance: 0.5,
  trust: 0.2,
  capability: 0.3,
  risk: 0.2,
};

const VALID_DIMENSIONS = new Set(["relevance", "trust", "capability", "risk"]);
const REQUIRED_WEIGHT_KEYS = ["relevance", "trust", "capability", "risk"];
const REQUIRED_RULE_KEYS = ["id", "rule_type", "field", "operator", "dimension", "score_delta"];
const ALLOWED_RULE_KEYS = new Set([...REQUIRED_RULE_KEYS, "value", "priority", "blocking", "override_group"]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isReasonableScalar(value) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

/**
 * @param {string} code
 * @param {string} message
 * @param {string=} path
 * @returns {import("./types.ts").ConfigValidationIssue}
 */
function issue(code, message, path) {
  return { code, message, path: path || "" };
}

/**
 * @param {unknown} value
 * @returns {import("./types.ts").ScoringWeights}
 */
function normalizeWeights(value) {
  const input = isObject(value) ? value : {};

  return {
    relevance: Number(input.relevance),
    trust: Number(input.trust),
    capability: Number(input.capability),
    risk: Number(input.risk),
  };
}

/**
 * @param {unknown} configJson
 * @returns {{ input: Record<string, unknown>, errors: import("./types.ts").ConfigValidationIssue[], warnings: import("./types.ts").ConfigValidationIssue[] }}
 */
function validateConfigShape(configJson) {
  const errors = [];
  const warnings = [];

  if (!isObject(configJson)) {
    return {
      input: {},
      errors: [issue("invalid_config", "Config must be an object.", "$")],
      warnings,
    };
  }

  return {
    input: configJson,
    errors,
    warnings,
  };
}

/**
 * @param {Record<string, unknown>} input
 * @param {import("./types.ts").ConfigValidationIssue[]} errors
 */
function validateMetadata(input, errors) {
  if (!isNonEmptyString(input.version)) {
    errors.push(issue("missing_version", "Config version must be a non-empty string.", "$.version"));
  }

  if (!isObject(input.metadata)) {
    errors.push(issue("missing_metadata", "Config metadata must be an object.", "$.metadata"));
    return;
  }

  if (!isNonEmptyString(input.metadata.name)) {
    errors.push(issue("missing_metadata_name", "Config metadata.name must be a non-empty string.", "$.metadata.name"));
  }
}

/**
 * @param {Record<string, unknown>} input
 * @param {import("./types.ts").ConfigValidationIssue[]} errors
 */
function validateWeights(input, errors) {
  if (!isObject(input.weights)) {
    errors.push(issue("missing_weights", "Config weights must be an object.", "$.weights"));
    return;
  }

  for (const key of REQUIRED_WEIGHT_KEYS) {
    const value = input.weights[key];
    if (value === undefined) {
      errors.push(issue("missing_weight", `Weight is required: ${key}`, `$.weights.${key}`));
      continue;
    }
    if (!isFiniteNumber(value)) {
      errors.push(issue("invalid_weight", `Weight must be a finite number: ${key}`, `$.weights.${key}`));
      continue;
    }
    if (value < 0) {
      errors.push(issue("negative_weight", `Weight cannot be negative: ${key}`, `$.weights.${key}`));
    }
  }
}

/**
 * @param {Record<string, unknown>} rule
 * @param {number} index
 * @param {Set<string>} seenRuleIds
 * @param {import("./types.ts").ConfigValidationIssue[]} errors
 */
function validateRule(rule, index, seenRuleIds, errors) {
  const path = `$.rules[${index}]`;

  for (const key of Object.keys(rule)) {
    if (!ALLOWED_RULE_KEYS.has(key)) {
      errors.push(issue("unknown_rule_field", `Rule contains unsupported field: ${key}`, `${path}.${key}`));
    }
  }

  for (const key of REQUIRED_RULE_KEYS) {
    if (rule[key] === undefined || rule[key] === null || rule[key] === "") {
      errors.push(issue("missing_rule_field", `Rule is missing required field: ${key}`, `${path}.${key}`));
    }
  }

  if (isNonEmptyString(rule.id)) {
    if (seenRuleIds.has(rule.id)) {
      errors.push(issue("duplicate_rule_id", `Rule id must be unique: ${rule.id}`, `${path}.id`));
    }
    seenRuleIds.add(rule.id);
  }

  if (rule.rule_type !== undefined && !VALID_RULE_TYPES.has(rule.rule_type)) {
    errors.push(issue("unknown_rule_type", `Rule type is not supported: ${String(rule.rule_type)}`, `${path}.rule_type`));
  }

  if (rule.field !== undefined && !VALID_FIELDS.has(rule.field)) {
    errors.push(issue("unknown_field", `Rule field is not supported: ${String(rule.field)}`, `${path}.field`));
  }

  if (rule.operator !== undefined && !VALID_OPERATORS.has(rule.operator)) {
    errors.push(issue("unknown_operator", `Rule operator is not supported: ${String(rule.operator)}`, `${path}.operator`));
  }

  if (rule.dimension !== undefined && !VALID_DIMENSIONS.has(rule.dimension)) {
    errors.push(issue("unknown_dimension", `Rule dimension is not supported: ${String(rule.dimension)}`, `${path}.dimension`));
  }

  if (rule.score_delta !== undefined && !isFiniteNumber(rule.score_delta)) {
    errors.push(issue("invalid_score_delta", "Rule score_delta must be a finite number.", `${path}.score_delta`));
  }

  if (rule.priority !== undefined && !isFiniteNumber(rule.priority)) {
    errors.push(issue("invalid_priority", "Rule priority must be a finite number.", `${path}.priority`));
  }

  if (rule.blocking !== undefined && typeof rule.blocking !== "boolean") {
    errors.push(issue("invalid_blocking", "Rule blocking must be a boolean.", `${path}.blocking`));
  }

  if (
    rule.override_group !== undefined &&
    rule.override_group !== null &&
    !isNonEmptyString(rule.override_group)
  ) {
    errors.push(issue("invalid_override_group", "Rule override_group must be a non-empty string or null.", `${path}.override_group`));
  }

  if (rule.operator === "in" && (!Array.isArray(rule.value) || rule.value.length === 0)) {
    errors.push(issue("invalid_value_type", "Operator in requires a non-empty array value.", `${path}.value`));
  }

  if ((rule.operator === "contains" || rule.operator === "equals") && !isReasonableScalar(rule.value)) {
    errors.push(issue("invalid_value_type", `Operator ${String(rule.operator)} requires a scalar value.`, `${path}.value`));
  }
}

/**
 * @param {Record<string, unknown>} input
 * @param {import("./types.ts").ConfigValidationIssue[]} errors
 */
function validateRules(input, errors) {
  if (!Array.isArray(input.rules)) {
    errors.push(issue("missing_rules", "Config rules must be an array.", "$.rules"));
    return;
  }

  const seenRuleIds = new Set();
  input.rules.forEach((rule, index) => {
    if (!isObject(rule)) {
      errors.push(issue("invalid_rule", "Rule must be an object.", `$.rules[${index}]`));
      return;
    }
    validateRule(rule, index, seenRuleIds, errors);
  });
}

/**
 * Load and validate a scoring config object.
 *
 * @param {unknown} configJson
 * @returns {import("./types.ts").LoadedScoringConfig}
 */
function loadConfig(configJson) {
  const shape = validateConfigShape(configJson);
  const input = shape.input;
  const validationErrors = [...shape.errors];
  const validationWarnings = [...shape.warnings];

  if (shape.errors.length === 0) {
    validateMetadata(input, validationErrors);
    validateWeights(input, validationErrors);
    validateRules(input, validationErrors);
  }

  const config = {
    version: isNonEmptyString(input.version) ? input.version : "invalid",
    metadata: isObject(input.metadata) ? input.metadata : undefined,
    weights: normalizeWeights(input.weights),
    rules: Array.isArray(input.rules) ? input.rules : [],
  };

  return {
    config,
    validation_errors: validationErrors,
    validation_warnings: validationWarnings,
    is_valid: validationErrors.length === 0,
  };
}

module.exports = {
  loadConfig,
  DEFAULT_SCORING_WEIGHTS,
  VALID_DIMENSIONS,
};
