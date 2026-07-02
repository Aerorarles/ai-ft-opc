// @ts-check

/**
 * @typedef {"keyword" | "country" | "industry" | "signal" | "risk" | "contact"} RuleType
 * @typedef {"contains" | "in" | "equals" | "exists"} RuleOperator
 * @typedef {"company_name" | "website" | "country" | "industry" | "email" | "phone" | "signals" | "has_email" | "has_phone" | "industry_keywords"} RuleField
 * @typedef {"relevance" | "trust" | "capability" | "risk"} ScoreDimension
 */

/**
 * Formal Lead input. company_name is the canonical company field.
 *
 * @typedef {Object} Lead
 * @property {string=} company_name
 * @property {string=} company Legacy compatibility field. Prefer company_name in all new callers.
 * @property {string=} country
 * @property {string=} industry
 * @property {string=} email
 * @property {string=} phone
 * @property {string=} website
 * @property {string=} notes
 * @property {string[]=} signals
 */

/**
 * @typedef {Object} LeadFeatures
 * @property {string} company_name
 * @property {string | null} website
 * @property {boolean} has_email
 * @property {boolean} has_phone
 * @property {string | null} country
 * @property {string | null} industry
 * @property {string | null} email
 * @property {string | null} phone
 * @property {string[]} industry_keywords
 * @property {string[]} signals
 */

/**
 * @typedef {Object} ScoringRule
 * @property {string} id
 * @property {RuleType} rule_type
 * @property {RuleOperator} operator
 * @property {RuleField} field
 * @property {string | string[] | boolean=} value
 * @property {ScoreDimension=} dimension
 * @property {number=} score_delta
 * @property {number=} delta Legacy compatibility alias for score_delta.
 * @property {number=} priority Higher priority rules run first. Defaults to 0.
 * @property {boolean=} blocking When matched, stops further scoring for the same dimension.
 * @property {string | null=} override_group Rules in the same group allow only the highest priority rule to run.
 */

/**
 * @typedef {Object} ScoringWeights
 * @property {number} relevance
 * @property {number} trust
 * @property {number} capability
 * @property {number} risk
 */

/**
 * @typedef {Object} ScoringConfigMetadata
 * @property {string} name
 * @property {string} description
 * @property {string} created_at
 */

/**
 * @typedef {Object} ScoringConfig
 * @property {string} version
 * @property {ScoringConfigMetadata=} metadata
 * @property {ScoringWeights} weights
 * @property {ScoringRule[]} rules
 */

/**
 * @typedef {Object} AppliedRule
 * @property {string} rule_id
 * @property {RuleType} rule_type
 * @property {RuleField} field
 * @property {RuleOperator} operator
 * @property {string | string[] | boolean | number | null=} expected_value
 * @property {string} actual_value_summary
 * @property {number} raw_delta
 * @property {number} weight
 * @property {number} effective_delta
 * @property {ScoreDimension} dimension
 * @property {number=} priority
 * @property {boolean=} blocked
 * @property {"blocked_rule" | "overridden" | "lower_priority" | "invalid_field" | "invalid_operator" | null=} skipped_reason
 */

/**
 * @typedef {Object} EvaluationWarning
 * @property {string} rule_id
 * @property {string} code
 * @property {string} message
 */

/**
 * @typedef {Object} ConfigValidationIssue
 * @property {string} code
 * @property {string} message
 * @property {string=} path
 */

/**
 * @typedef {Object} ScoreBreakdown
 * @property {number} relevance
 * @property {number} trust
 * @property {number} capability
 * @property {number} risk
 */

/**
 * @typedef {Object} InputSummary
 * @property {boolean} has_company_name
 * @property {boolean} has_website
 * @property {boolean} has_email
 * @property {boolean} has_phone
 * @property {string | null} country
 * @property {number} industry_keywords_count
 * @property {number} signals_count
 */

/**
 * @typedef {Object} ScoreResult
 * @property {"0.6"} engine_version
 * @property {string | null} config_version
 * @property {number | null} total_score
 * @property {ScoreBreakdown} breakdown
 * @property {AppliedRule[]} applied_rules
 * @property {SkippedRule[]} skipped_rules
 * @property {ScoreDimension[]} blocked_dimensions
 * @property {AppliedRule[]} override_applied_rules
 * @property {EvaluationWarning[]} evaluation_warnings
 * @property {ConfigValidationIssue[]} validation_errors
 * @property {ConfigValidationIssue[]} validation_warnings
 * @property {InputSummary} input_summary
 * @property {ScoringExecutionContext} execution_context
 * @property {{ grade: string | null, priority: string | null, policy_applied: boolean, reason: string }} outcome
 * @property {{ execution_id: string, event_count: number, event_types: string[] }} execution_trace_summary
 * @property {number} event_count
 * @property {string[]} rule_execution_path
 * @property {string[]} blocking_path
 * @property {string[]} override_path
 * @property {"memory" | "event_store" | "event_store_snapshot"=} persistence_source_used
 * @property {boolean=} snapshot_used
 * @property {boolean=} idempotency_reused
 */

/**
 * @typedef {Object} LoadedScoringConfig
 * @property {ScoringConfig} config
 * @property {ConfigValidationIssue[]} validation_errors
 * @property {ConfigValidationIssue[]} validation_warnings
 * @property {boolean} is_valid
 */

/**
 * @typedef {"api" | "n8n" | "manual" | "replay" | "shadow"} TriggerSource
 * @typedef {"live" | "shadow" | "replay" | "preview"} RunMode
 */

/**
 * @typedef {Object} ScoringExecutionContext
 * @property {string} execution_id
 * @property {string=} lead_id
 * @property {string} config_version_id
 * @property {string} config_checksum
 * @property {string} outcome_policy_id
 * @property {string} outcome_policy_version
 * @property {string} outcome_policy_checksum
 * @property {string} engine_version
 * @property {TriggerSource} trigger_source
 * @property {RunMode} run_mode
 * @property {string} idempotency_key
 * @property {string} request_trace_id
 * @property {string} tenant_id
 * @property {"snapshot" | "event_store" | "memory" | "auto"=} replay_source_preference
 */

/**
 * @typedef {Partial<ScoringExecutionContext>} ScoringExecutionContextInput
 */

/**
 * @typedef {Object} SkippedRule
 * @property {string} rule_id
 * @property {RuleType=} rule_type
 * @property {RuleField=} field
 * @property {RuleOperator=} operator
 * @property {ScoreDimension=} dimension
 * @property {number} priority
 * @property {string | null} override_group
 * @property {"blocked_rule" | "overridden" | "lower_priority" | "invalid_field" | "invalid_operator"} skipped_reason
 */

module.exports = {};
