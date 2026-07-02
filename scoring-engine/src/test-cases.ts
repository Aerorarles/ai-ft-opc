// @ts-check

if (typeof require !== "undefined" && require.extensions && !require.extensions[".ts"]) {
  require.extensions[".ts"] = require.extensions[".js"];
}

const { loadConfig } = require("./config.ts");
const { scoreLead } = require("./engine.ts");
const { previewLeadScore } = require("./preview.ts");
const { appendEvent, getEvents } = require("./execution-trace-store.ts");
const { replayExecution } = require("./replay.ts");
const { ReplayRouter } = require("./replay-router.ts");
const { scoreLeadAPI } = require("./api/scoring-service.ts");
const scoringConfigJson = require("../../scoring-config/v1.json");
const invalidScoringConfigJson = require("../../scoring-config/v1-invalid.json");

const baseLead = {
  company_name: "ABC Displays",
  country: "US",
  industry: "Retail Display Manufacturing",
  email: "info@abc.com",
  phone: "+1 555 0100",
  website: "https://abcdisplays.example",
  signals: ["factory", "export", "display"],
};

const baseConfig = loadConfig(scoringConfigJson);
const invalidConfig = loadConfig(invalidScoringConfigJson);

class FakeEventStore {
  /** @type {Map<string, import("./execution-events.ts").ScoringExecutionEvent[]>} */
  events;

  /** @type {Map<string, import("./persistence/event-store.interface.ts").ExecutionSnapshot>} */
  snapshots;

  /** @type {Map<string, string>} */
  idempotency;

  /** @type {Map<string, import("./persistence/event-store.interface.ts").ReplayConsistencyResult>} */
  replayResults;

  constructor() {
    this.events = new Map();
    this.snapshots = new Map();
    this.idempotency = new Map();
    this.replayResults = new Map();
  }

  appendEvent(execution_id, event) {
    if (!this.events.has(execution_id)) {
      this.events.set(execution_id, []);
    }
    this.events.get(execution_id).push(event);
    return event;
  }

  getEvents(execution_id) {
    return [...(this.events.get(execution_id) || [])];
  }

  getExecutionSnapshot(execution_id) {
    return this.snapshots.get(execution_id) || null;
  }

  saveSnapshot(execution_id, snapshot) {
    this.snapshots.set(execution_id, snapshot);
    return snapshot;
  }

  markReplayConsistency(execution_id, result) {
    this.replayResults.set(execution_id, result);
  }

  getExecutionIdByIdempotencyKey(idempotency_key) {
    return this.idempotency.get(idempotency_key) || null;
  }

  reserveIdempotencyKey(idempotency_key, execution_id) {
    if (!this.idempotency.has(idempotency_key)) {
      this.idempotency.set(idempotency_key, execution_id);
    }
  }
}

/**
 * @param {import("./types.ts").ScoringRule[]} rules
 * @returns {import("./types.ts").LoadedScoringConfig}
 */
function configWithRules(rules) {
  return loadConfig({
    ...scoringConfigJson,
    rules,
  });
}

/**
 * @param {string} name
 * @param {() => void} fn
 */
function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
  }
}

/**
 * @param {unknown} actual
 * @param {unknown} expected
 * @param {string} message
 */
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/**
 * @param {unknown} condition
 * @param {string} message
 */
function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * @param {import("./types.ts").ConfigValidationIssue[]} issues
 * @param {string} code
 * @returns {boolean}
 */
function hasIssueCode(issues, code) {
  return issues.some((issue) => issue.code === code);
}

test("valid v1.json passes config validation", () => {
  assertEqual(baseConfig.is_valid, true, "Valid config should pass");
  assertEqual(baseConfig.validation_errors.length, 0, "Valid config should not have validation errors");
});

test("normal example returns total_score 21", () => {
  const result = scoreLead(baseLead, baseConfig);
  assertEqual(result.total_score, 21, "Unexpected total score");
  assertEqual(result.breakdown.relevance, 30, "Unexpected relevance score");
  assertEqual(result.breakdown.trust, 15, "Unexpected trust score");
  assertEqual(result.breakdown.capability, 10, "Unexpected capability score");
  assertEqual(result.breakdown.risk, 0, "Unexpected risk score");
});

test("wordpress risk applies once without double subtraction", () => {
  const result = scoreLead({
    ...baseLead,
    website: "https://wordpress.example",
  }, baseConfig);
  assertEqual(result.breakdown.risk, -10, "Risk dimension should keep actual negative delta");
  assertEqual(result.total_score, 19, "Risk should be directly weighted, not subtracted again");
});

test("empty email does not match contact-email-exists", () => {
  const result = scoreLead({
    ...baseLead,
    email: "",
  }, baseConfig);
  assertTrue(!result.applied_rules.some((rule) => rule.rule_id === "contact-email-exists"), "Email rule should not match");
});

test("missing field rule is blocked by config validation", () => {
  const result = scoreLead(baseLead, configWithRules([{
    id: "missing-field",
    rule_type: "keyword",
    operator: "contains",
    value: "display",
    dimension: "relevance",
    score_delta: 20,
  }]));
  assertEqual(result.total_score, null, "Invalid config should not calculate a score");
  assertTrue(hasIssueCode(result.validation_errors, "missing_rule_field"), "Missing field validation error expected");
});

test("unknown operator rule is blocked by config validation", () => {
  const result = scoreLead(baseLead, configWithRules([{
    id: "unknown-operator",
    rule_type: "keyword",
    operator: "starts_with",
    field: "industry_keywords",
    value: "display",
    dimension: "relevance",
    score_delta: 20,
  }]));
  assertEqual(result.total_score, null, "Unknown operator config should not calculate a score");
  assertTrue(hasIssueCode(result.validation_errors, "unknown_operator"), "Unknown operator validation error expected");
});

test("factory signal matches as array item", () => {
  const signalRule = baseConfig.config.rules.find((rule) => rule.id === "signal-factory");
  const result = scoreLead(baseLead, configWithRules([signalRule]));
  assertEqual(result.total_score, 3, "Signal score should apply capability weight");
  assertEqual(result.applied_rules[0].rule_id, "signal-factory", "Factory signal rule should match");
});

test("country trims and lowercases before matching", () => {
  const countryRule = baseConfig.config.rules.find((rule) => rule.id === "country-target-markets");
  const result = scoreLead({
    ...baseLead,
    country: " us ",
  }, configWithRules([countryRule]));
  assertEqual(result.total_score, 5, "Country rule should match after normalization");
});

test("invalid config is blocked and total_score is null", () => {
  const result = scoreLead(baseLead, invalidConfig);
  assertEqual(invalidConfig.is_valid, false, "Invalid config should fail validation");
  assertEqual(result.total_score, null, "Invalid config should not calculate formal score");
});

test("duplicate rule id is detected", () => {
  assertTrue(hasIssueCode(invalidConfig.validation_errors, "duplicate_rule_id"), "Duplicate rule id should be detected");
});

test("illegal operator is detected", () => {
  assertTrue(hasIssueCode(invalidConfig.validation_errors, "unknown_operator"), "Illegal operator should be detected");
});

test("negative weight is detected", () => {
  assertTrue(hasIssueCode(invalidConfig.validation_errors, "negative_weight"), "Negative weight should be detected");
});

test("invalid in value and unknown field are detected", () => {
  assertTrue(hasIssueCode(invalidConfig.validation_errors, "invalid_value_type"), "Invalid in value should be detected");
  assertTrue(hasIssueCode(invalidConfig.validation_errors, "unknown_field"), "Unknown field should be detected");
});

test("preview summary does not expose full email or phone", () => {
  const preview = previewLeadScore(baseLead, scoringConfigJson);
  const serializedPreview = JSON.stringify(preview);
  assertTrue(!serializedPreview.includes("info@abc.com"), "Preview must not expose full email");
  assertTrue(!serializedPreview.includes("+1 555 0100"), "Preview must not expose full phone");
  assertTrue(preview.human_readable_summary.includes("4 条规则"), "Preview summary should be generated");
});

test("normal v1 preview returns total_score 21", () => {
  const preview = previewLeadScore(baseLead, scoringConfigJson);
  assertEqual(preview.is_config_valid, true, "Preview config should be valid");
  assertEqual(preview.score_result.total_score, 21, "Preview total score should remain 21");
});

test("blocking rule stops dimension scoring", () => {
  const result = scoreLead(baseLead, configWithRules([
    {
      id: "blocking-display",
      rule_type: "keyword",
      operator: "contains",
      field: "industry_keywords",
      value: "display",
      dimension: "relevance",
      score_delta: 100,
      priority: 100,
      blocking: true,
    },
    {
      id: "lower-display",
      rule_type: "keyword",
      operator: "contains",
      field: "industry_keywords",
      value: "display",
      dimension: "relevance",
      score_delta: 20,
      priority: 10,
    },
  ]));
  assertEqual(result.breakdown.relevance, 100, "Blocking rule should be the only relevance score");
  assertTrue(result.blocked_dimensions.includes("relevance"), "Relevance should be blocked");
  assertTrue(result.skipped_rules.some((rule) => rule.rule_id === "lower-display" && rule.skipped_reason === "blocked_rule"), "Lower relevance rule should be skipped by blocking rule");
});

test("override_group ignores lower priority rule", () => {
  const result = scoreLead(baseLead, configWithRules([
    {
      id: "factory-capability-high",
      rule_type: "signal",
      operator: "contains",
      field: "signals",
      value: "factory",
      dimension: "capability",
      score_delta: 10,
      priority: 50,
      override_group: "capability-signal",
    },
    {
      id: "display-capability-low",
      rule_type: "signal",
      operator: "contains",
      field: "signals",
      value: "display",
      dimension: "capability",
      score_delta: 5,
      priority: 10,
      override_group: "capability-signal",
    },
  ]));
  assertEqual(result.breakdown.capability, 10, "Only highest priority override group rule should apply");
  assertEqual(result.override_applied_rules.length, 1, "One override group rule should apply");
  assertTrue(result.skipped_rules.some((rule) => rule.rule_id === "display-capability-low" && rule.skipped_reason === "lower_priority"), "Lower priority override rule should be skipped");
});

test("priority order executes high priority rule first", () => {
  const result = scoreLead(baseLead, configWithRules([
    {
      id: "country-low-priority",
      rule_type: "country",
      operator: "in",
      field: "country",
      value: ["US"],
      dimension: "relevance",
      score_delta: 10,
      priority: 1,
    },
    {
      id: "display-high-priority",
      rule_type: "keyword",
      operator: "contains",
      field: "industry_keywords",
      value: "display",
      dimension: "relevance",
      score_delta: 20,
      priority: 20,
    },
  ]));
  assertEqual(result.applied_rules[0].rule_id, "display-high-priority", "Higher priority rule should apply first");
  assertEqual(result.applied_rules[1].rule_id, "country-low-priority", "Lower priority rule should apply second");
});

test("execution_context is generated", () => {
  const result = scoreLead(baseLead, baseConfig, {
    trigger_source: "manual",
    run_mode: "preview",
    tenant_id: "tenant-test",
  });
  assertEqual(result.engine_version, "0.6", "Engine should report v0.6");
  assertEqual(result.execution_context.engine_version, "0.6", "Execution context should report engine v0.6");
  assertEqual(result.execution_context.trigger_source, "manual", "Trigger source should be preserved");
  assertEqual(result.execution_context.run_mode, "preview", "Run mode should be preserved");
  assertEqual(result.execution_context.tenant_id, "tenant-test", "Tenant should be preserved");
  assertEqual(result.execution_context.replay_source_preference, "auto", "Replay source preference should be recorded but not decided by engine");
  assertTrue(Boolean(result.execution_context.execution_id), "Execution id should be generated");
  assertTrue(Boolean(result.execution_context.idempotency_key), "Idempotency key should be generated");
});

test("replay execution preserves execution_id and idempotency_key", () => {
  const replayContext = {
    execution_id: "exec-replay-001",
    idempotency_key: "idem-replay-001",
    trigger_source: "replay",
    run_mode: "replay",
    request_trace_id: "trace-replay-001",
    tenant_id: "tenant-replay",
  };
  const result = scoreLead(baseLead, baseConfig, replayContext);
  assertEqual(result.execution_context.execution_id, "exec-replay-001", "Replay execution id should be stable");
  assertEqual(result.execution_context.idempotency_key, "idem-replay-001", "Replay idempotency key should be stable");
  assertEqual(result.execution_context.trigger_source, "replay", "Replay trigger source should be stable");
  assertEqual(result.execution_context.run_mode, "replay", "Replay run mode should be stable");
});

test("execution trace event count is correct for normal v1 config", () => {
  const result = scoreLead(baseLead, baseConfig, {
    execution_id: "trace-count-001",
    idempotency_key: "trace-count-idem-001",
  });
  const events = getEvents(result.execution_context.execution_id);
  assertEqual(events.length, 11, "Normal v1 trace should contain feature + 5 rule evaluations + 4 updates + final");
  assertEqual(result.event_count, events.length, "Result event_count should match store event count");
});

test("rule evaluation event vs skipped event are classified correctly", () => {
  const result = scoreLead(baseLead, configWithRules([
    {
      id: "factory-capability-high-classify",
      rule_type: "signal",
      operator: "contains",
      field: "signals",
      value: "factory",
      dimension: "capability",
      score_delta: 10,
      priority: 50,
      override_group: "classification-group",
    },
    {
      id: "display-capability-low-classify",
      rule_type: "signal",
      operator: "contains",
      field: "signals",
      value: "display",
      dimension: "capability",
      score_delta: 5,
      priority: 10,
      override_group: "classification-group",
    },
  ]), {
    execution_id: "trace-classify-001",
    idempotency_key: "trace-classify-idem-001",
  });
  const events = getEvents(result.execution_context.execution_id);
  assertTrue(events.some((event) => event.event_type === "rule_evaluation" && event.rule_id === "factory-capability-high-classify" && event.matched === true), "Selected override rule should have rule_evaluation event");
  assertTrue(events.some((event) => event.event_type === "rule_skipped" && event.rule_id === "display-capability-low-classify" && event.skipped_reason === "lower_priority"), "Lower priority override rule should have rule_skipped event");
});

test("blocking event is emitted when blocking rule matches", () => {
  const result = scoreLead(baseLead, configWithRules([
    {
      id: "blocking-display-event",
      rule_type: "keyword",
      operator: "contains",
      field: "industry_keywords",
      value: "display",
      dimension: "relevance",
      score_delta: 100,
      priority: 100,
      blocking: true,
    },
    {
      id: "lower-display-event",
      rule_type: "keyword",
      operator: "contains",
      field: "industry_keywords",
      value: "display",
      dimension: "relevance",
      score_delta: 20,
      priority: 10,
    },
  ]), {
    execution_id: "trace-blocking-001",
    idempotency_key: "trace-blocking-idem-001",
  });
  const events = getEvents(result.execution_context.execution_id);
  assertTrue(events.some((event) => event.event_type === "blocking" && event.dimension === "relevance" && event.blocking_rule_id === "blocking-display-event"), "Blocking event should be emitted");
});

test("override event records selected and skipped rules", () => {
  const result = scoreLead(baseLead, configWithRules([
    {
      id: "factory-override-selected",
      rule_type: "signal",
      operator: "contains",
      field: "signals",
      value: "factory",
      dimension: "capability",
      score_delta: 10,
      priority: 50,
      override_group: "override-event-group",
    },
    {
      id: "display-override-skipped",
      rule_type: "signal",
      operator: "contains",
      field: "signals",
      value: "display",
      dimension: "capability",
      score_delta: 5,
      priority: 10,
      override_group: "override-event-group",
    },
  ]), {
    execution_id: "trace-override-001",
    idempotency_key: "trace-override-idem-001",
  });
  const events = getEvents(result.execution_context.execution_id);
  assertTrue(events.some((event) =>
    event.event_type === "override" &&
    event.override_group === "override-event-group" &&
    event.selected_rule_id === "factory-override-selected" &&
    event.skipped_rule_ids.includes("display-override-skipped")
  ), "Override event should record selected and skipped rules");
});

test("replay execution equals original execution", () => {
  const original = scoreLead(baseLead, baseConfig, {
    execution_id: "trace-replay-equal-001",
    idempotency_key: "trace-replay-equal-idem-001",
  });
  const replayed = replayExecution(original.execution_context.execution_id);
  assertEqual(replayed.recomputed_total_score, original.total_score, "Replay total score should equal original");
  assertEqual(replayed.final_score_event_total, original.total_score, "Final score event should equal original");
  assertEqual(replayed.is_consistent, true, "Replay should be consistent");
  assertEqual(JSON.stringify(replayed.breakdown), JSON.stringify(original.breakdown), "Replay breakdown should equal original");
  assertEqual(replayed.applied_rules.map((rule) => rule.rule_id).join(","), original.applied_rules.map((rule) => rule.rule_id).join(","), "Replay applied rules should equal original");
  assertEqual(replayed.skipped_rules.length, original.skipped_rules.length, "Replay skipped rules should equal original");
});

test("event order is deterministic", () => {
  const result = scoreLead(baseLead, baseConfig, {
    execution_id: "trace-order-001",
    idempotency_key: "trace-order-idem-001",
  });
  const events = getEvents(result.execution_context.execution_id);
  const sequence = events.map((event) => event.sequence_index).join(",");
  assertEqual(sequence, "0,1,2,3,4,5,6,7,8,9,10", "Event sequence should be deterministic");
  assertEqual(events[0].event_type, "feature_extraction", "First event should be feature extraction");
  assertEqual(events[events.length - 1].event_type, "final_score", "Last event should be final score");
});

test("final score event matches engine output", () => {
  const result = scoreLead(baseLead, baseConfig, {
    execution_id: "trace-final-001",
    idempotency_key: "trace-final-idem-001",
  });
  const events = getEvents(result.execution_context.execution_id);
  const finalEvent = events.find((event) => event.event_type === "final_score");
  assertTrue(Boolean(finalEvent), "Final score event should exist");
  assertEqual(finalEvent.total_score, result.total_score, "Final event total score should match result");
  assertEqual(JSON.stringify(finalEvent.breakdown), JSON.stringify(result.breakdown), "Final event breakdown should match result");
});

test("normal scoring emits feature, rule evaluation, dimension update, and final events", () => {
  const result = scoreLead(baseLead, baseConfig, {
    execution_id: "trace-required-events-001",
    idempotency_key: "trace-required-events-idem-001",
  });
  const eventTypes = getEvents(result.execution_context.execution_id).map((event) => event.event_type);
  assertTrue(eventTypes.includes("feature_extraction"), "FeatureExtractionEvent should exist");
  assertTrue(eventTypes.includes("rule_evaluation"), "RuleEvaluationEvent should exist");
  assertTrue(eventTypes.includes("dimension_score_update"), "DimensionScoreUpdateEvent should exist");
  assertTrue(eventTypes.includes("final_score"), "FinalScoreEvent should exist");
});

test("each rule reaches either evaluated or skipped terminal event once", () => {
  const result = scoreLead(baseLead, configWithRules([
    {
      id: "terminal-selected",
      rule_type: "signal",
      operator: "contains",
      field: "signals",
      value: "factory",
      dimension: "capability",
      score_delta: 10,
      priority: 20,
      override_group: "terminal-group",
    },
    {
      id: "terminal-skipped",
      rule_type: "signal",
      operator: "contains",
      field: "signals",
      value: "display",
      dimension: "capability",
      score_delta: 5,
      priority: 1,
      override_group: "terminal-group",
    },
  ]), {
    execution_id: "trace-terminal-001",
    idempotency_key: "trace-terminal-idem-001",
  });
  const events = getEvents(result.execution_context.execution_id);
  const terminalEvents = events.filter((event) =>
    (event.event_type === "rule_evaluation" || event.event_type === "rule_skipped") &&
    (event.rule_id === "terminal-selected" || event.rule_id === "terminal-skipped")
  );
  assertEqual(terminalEvents.length, 2, "Each rule should have exactly one terminal event");
  assertEqual(new Set(terminalEvents.map((event) => event.rule_id)).size, 2, "Terminal events should cover both rules");
});

test("blocking rule emits skipped event for later same-dimension rule", () => {
  const result = scoreLead(baseLead, configWithRules([
    {
      id: "blocking-terminal",
      rule_type: "keyword",
      operator: "contains",
      field: "industry_keywords",
      value: "display",
      dimension: "relevance",
      score_delta: 100,
      priority: 100,
      blocking: true,
    },
    {
      id: "blocked-terminal",
      rule_type: "country",
      operator: "in",
      field: "country",
      value: ["US"],
      dimension: "relevance",
      score_delta: 10,
      priority: 1,
    },
  ]), {
    execution_id: "trace-blocked-skipped-001",
    idempotency_key: "trace-blocked-skipped-idem-001",
  });
  const events = getEvents(result.execution_context.execution_id);
  assertTrue(events.some((event) => event.event_type === "rule_skipped" && event.rule_id === "blocked-terminal" && event.skipped_reason === "blocked"), "Blocked rule should emit RuleSkippedEvent");
});

test("replay detects tampered final score event", () => {
  const result = scoreLead(baseLead, baseConfig, {
    execution_id: "trace-tamper-001",
    idempotency_key: "trace-tamper-idem-001",
  });
  const events = getEvents(result.execution_context.execution_id);
  const finalEvent = events.find((event) => event.event_type === "final_score");
  assertTrue(Boolean(finalEvent), "Original final event should exist before tamper");
  appendEvent(result.execution_context.execution_id, {
    ...finalEvent,
    event_id: "trace-tamper-001:tampered-final",
    sequence_index: 999,
    timestamp: "2099-01-01T00:00:00.000Z",
    total_score: 999,
  });
  const replayed = replayExecution(result.execution_context.execution_id);
  assertEqual(replayed.is_consistent, false, "Replay should detect tampered final score");
  assertTrue(replayed.consistency_errors.some((error) => error.includes("final_score_mismatch")), "Mismatch should be reported");
});

test("execution context anchors are available from replay", () => {
  const result = scoreLead(baseLead, baseConfig, {
    execution_id: "trace-context-001",
    idempotency_key: "trace-context-idem-001",
    request_trace_id: "trace-context-request-001",
    tenant_id: "tenant-context",
    trigger_source: "shadow",
    run_mode: "shadow",
    outcome_policy_id: "policy-test",
    outcome_policy_version: "policy-v1",
    outcome_policy_checksum: "policy-checksum-test",
  });
  const replayed = replayExecution(result.execution_context.execution_id);
  assertEqual(replayed.execution_context_summary.config_checksum, result.execution_context.config_checksum, "Replay should expose config checksum");
  assertEqual(replayed.execution_context_summary.outcome_policy_id, "policy-test", "Replay should expose outcome policy id");
  assertEqual(replayed.execution_context_summary.outcome_policy_checksum, "policy-checksum-test", "Replay should expose outcome policy checksum");
  assertEqual(replayed.execution_context_summary.trigger_source, "shadow", "Replay should expose trigger source");
  assertEqual(replayed.execution_context_summary.run_mode, "shadow", "Replay should expose run mode");
  assertEqual(replayed.execution_context_summary.idempotency_key, "trace-context-idem-001", "Replay should expose idempotency key");
});

test("config validation failure returns null score and minimal trace", () => {
  const result = scoreLead(baseLead, invalidConfig, {
    execution_id: "trace-invalid-config-001",
    idempotency_key: "trace-invalid-config-idem-001",
  });
  const events = getEvents(result.execution_context.execution_id);
  assertEqual(result.total_score, null, "Invalid config should return null total");
  assertEqual(events.length, 2, "Invalid config should emit feature extraction and final only");
  assertEqual(events[0].event_type, "feature_extraction", "Invalid config first event should be feature extraction");
  assertEqual(events[1].event_type, "final_score", "Invalid config final event should be final score");
  assertEqual(events[1].total_score, null, "Invalid config final score event should be null");
});

test("persistence disabled uses memory fallback", () => {
  const result = scoreLead(baseLead, baseConfig, {
    execution_id: "persist-memory-001",
    idempotency_key: "persist-memory-idem-001",
  });
  const replayed = replayExecution(result.execution_context.execution_id);
  assertEqual(result.persistence_source_used, "memory", "Engine should report memory persistence source");
  assertEqual(replayed.persistence_source_used, "memory", "Replay should use memory fallback");
  assertEqual(replayed.source_used, "memory", "Replay control plane should report memory source");
  assertEqual(replayed.snapshot_used, false, "Memory replay should not use snapshot");
  assertEqual(replayed.recomputed_total_score, 21, "Memory replay should recompute score");
});

test("persistence enabled writes event store and snapshot", () => {
  const eventStore = new FakeEventStore();
  const result = scoreLead(baseLead, baseConfig, {
    execution_id: "persist-store-001",
    idempotency_key: "persist-store-idem-001",
  }, { eventStore });
  assertEqual(result.persistence_source_used, "event_store", "Engine should report event_store source");
  assertEqual(eventStore.getEvents(result.execution_context.execution_id).length, result.event_count, "External event store should receive all events");
  assertTrue(Boolean(eventStore.getExecutionSnapshot(result.execution_context.execution_id)), "External event store should receive snapshot");
});

test("snapshot restore returns stored result before event replay", () => {
  const eventStore = new FakeEventStore();
  const result = scoreLead(baseLead, baseConfig, {
    execution_id: "persist-snapshot-001",
    idempotency_key: "persist-snapshot-idem-001",
  }, { eventStore });
  const replayed = replayExecution(result.execution_context.execution_id, { eventStore });
  assertEqual(replayed.source_used, "snapshot", "Replay router should choose snapshot");
  assertEqual(replayed.persistence_source_used, "db_snapshot", "Replay should use snapshot first");
  assertEqual(replayed.snapshot_used, true, "Snapshot should be used");
  assertEqual(replayed.total_score, result.total_score, "Snapshot replay score should match original");
});

test("replay from event store matches memory replay when snapshot is absent", () => {
  const eventStore = new FakeEventStore();
  const result = scoreLead(baseLead, baseConfig, {
    execution_id: "persist-event-replay-001",
    idempotency_key: "persist-event-replay-idem-001",
  }, { eventStore });
  eventStore.snapshots.delete(result.execution_context.execution_id);
  const dbReplay = replayExecution(result.execution_context.execution_id, { eventStore });
  const memoryReplay = replayExecution(result.execution_context.execution_id);
  assertEqual(dbReplay.source_used, "event_store", "Replay router should choose event store");
  assertEqual(dbReplay.persistence_source_used, "db_event_store", "Replay should use external event store");
  assertEqual(dbReplay.snapshot_used, false, "Event replay should not use snapshot");
  assertEqual(dbReplay.recomputed_total_score, memoryReplay.recomputed_total_score, "DB event replay should match memory replay");
  assertEqual(dbReplay.is_consistent, true, "DB event replay should be consistent");
});

test("idempotency key prevents duplicate persisted execution", () => {
  const eventStore = new FakeEventStore();
  const first = scoreLead(baseLead, baseConfig, {
    execution_id: "persist-idem-first",
    idempotency_key: "persist-idem-shared",
  }, { eventStore });
  const second = scoreLead(baseLead, baseConfig, {
    execution_id: "persist-idem-second",
    idempotency_key: "persist-idem-shared",
  }, { eventStore });
  assertEqual(second.idempotency_reused, true, "Second call should reuse previous idempotent result");
  assertEqual(second.execution_context.execution_id, first.execution_context.execution_id, "Second call should return first execution result");
  assertEqual(eventStore.getEvents("persist-idem-second").length, 0, "Second execution should not write duplicate events");
});

test("v0.6 snapshot valid selects snapshot", () => {
  const eventStore = new FakeEventStore();
  const result = scoreLead(baseLead, baseConfig, {
    execution_id: "router-snapshot-valid-001",
    idempotency_key: "router-snapshot-valid-idem-001",
  }, { eventStore });
  const selection = ReplayRouter.selectSource(result.execution_context.execution_id, {
    eventStore,
    config_checksum: result.execution_context.config_checksum,
    engine_version: result.engine_version,
  });
  const replayed = replayExecution(result.execution_context.execution_id, {
    eventStore,
    config_checksum: result.execution_context.config_checksum,
    engine_version: result.engine_version,
  });
  assertEqual(selection.source, "snapshot", "Valid snapshot should be selected");
  assertEqual(replayed.source_used, "snapshot", "Replay should use snapshot");
  assertEqual(replayed.selection_reason, "snapshot_valid_consistent_checksum_and_engine_match", "Snapshot selection reason should be explicit");
});

test("v0.6 snapshot invalid falls back to event_store", () => {
  const eventStore = new FakeEventStore();
  const result = scoreLead(baseLead, baseConfig, {
    execution_id: "router-snapshot-invalid-001",
    idempotency_key: "router-snapshot-invalid-idem-001",
  }, { eventStore });
  const snapshot = eventStore.getExecutionSnapshot(result.execution_context.execution_id);
  snapshot.is_consistent = false;
  eventStore.saveSnapshot(result.execution_context.execution_id, snapshot);
  const replayed = replayExecution(result.execution_context.execution_id, { eventStore });
  assertEqual(replayed.source_used, "event_store", "Invalid snapshot should fall back to event store");
  assertTrue(replayed.selection_reason.includes("snapshot_not_consistent"), "Selection reason should include invalid snapshot reason");
});

test("v0.6 event_store failure falls back to memory", () => {
  const eventStore = new FakeEventStore();
  const result = scoreLead(baseLead, baseConfig, {
    execution_id: "router-event-failure-001",
    idempotency_key: "router-event-failure-idem-001",
  }, { eventStore });
  eventStore.snapshots.delete(result.execution_context.execution_id);
  eventStore.getEvents = () => {
    throw new Error("event store unavailable");
  };
  const replayed = replayExecution(result.execution_context.execution_id, { eventStore });
  assertEqual(replayed.source_used, "memory", "Event store failure should fall back to memory");
  assertTrue(replayed.selection_reason.includes("memory_fallback"), "Selection reason should explain memory fallback");
  assertEqual(replayed.recomputed_total_score, result.total_score, "Memory fallback should replay local trace");
});

test("v0.6 checksum mismatch is classified", () => {
  const result = scoreLead(baseLead, baseConfig, {
    execution_id: "router-checksum-mismatch-001",
    idempotency_key: "router-checksum-mismatch-idem-001",
  });
  const replayed = replayExecution(result.execution_context.execution_id, {
    config_checksum: "wrong-checksum",
    engine_version: result.engine_version,
  });
  assertEqual(replayed.is_consistent, false, "Checksum mismatch should be inconsistent");
  assertEqual(replayed.inconsistency_type, "CHECKSUM_MISMATCH", "Checksum mismatch should be classified");
});

test("v0.6 engine version mismatch is classified", () => {
  const result = scoreLead(baseLead, baseConfig, {
    execution_id: "router-engine-mismatch-001",
    idempotency_key: "router-engine-mismatch-idem-001",
  });
  const replayed = replayExecution(result.execution_context.execution_id, {
    config_checksum: result.execution_context.config_checksum,
    engine_version: "0.5",
  });
  assertEqual(replayed.is_consistent, false, "Engine version mismatch should be inconsistent");
  assertEqual(replayed.inconsistency_type, "ENGINE_VERSION_MISMATCH", "Engine version mismatch should be classified");
});

test("v0.6 replay source selection is deterministic", () => {
  const eventStore = new FakeEventStore();
  const result = scoreLead(baseLead, baseConfig, {
    execution_id: "router-deterministic-001",
    idempotency_key: "router-deterministic-idem-001",
  }, { eventStore });
  const first = ReplayRouter.selectSource(result.execution_context.execution_id, { eventStore });
  const second = ReplayRouter.selectSource(result.execution_context.execution_id, { eventStore });
  assertEqual(first.source, second.source, "Replay source selection should be deterministic");
  assertEqual(first.selection_reason, second.selection_reason, "Replay selection reason should be deterministic");
});

test("v0.6 replay output includes selection_reason", () => {
  const result = scoreLead(baseLead, baseConfig, {
    execution_id: "router-selection-reason-001",
    idempotency_key: "router-selection-reason-idem-001",
  });
  const replayed = replayExecution(result.execution_context.execution_id);
  assertTrue(Boolean(replayed.selection_reason), "Replay output should include selection_reason");
  assertEqual(replayed.inconsistency_type, "NONE", "Normal replay should have no inconsistency");
});

test("v0.7 scoreLeadAPI returns deterministic result", () => {
  const request = {
    lead: baseLead,
    tenant_id: "local",
    config_version_id: "v1",
    request_trace_id: "api-deterministic-trace",
    run_mode: "preview",
  };
  const first = scoreLeadAPI(request);
  const second = scoreLeadAPI(request);
  assertEqual(first.execution_id, second.execution_id, "API execution id should be deterministic for the same request");
  assertEqual(first.total_score, second.total_score, "API total score should be deterministic");
  assertEqual(first.applied_rules.map((rule) => rule.rule_id).join(","), second.applied_rules.map((rule) => rule.rule_id).join(","), "API applied rules should be deterministic");
});

test("v0.7 shadow mode does not affect snapshot", () => {
  const eventStore = new FakeEventStore();
  const response = scoreLeadAPI({
    lead: baseLead,
    tenant_id: "local",
    config_version_id: "v1",
    request_trace_id: "api-shadow-trace",
    run_mode: "shadow",
    idempotency_key: "api-shadow-idem",
  }, { eventStore });
  assertEqual(eventStore.getExecutionSnapshot(response.execution_id), null, "Shadow mode should not save snapshot");
  assertTrue(eventStore.getEvents(response.execution_id).length > 0, "Shadow mode should still write events");
  assertEqual(response.replay_metadata.source_used, "event_store", "Shadow replay should use event store events");
});

test("v0.7 preview mode does not write event store events", () => {
  const eventStore = new FakeEventStore();
  const response = scoreLeadAPI({
    lead: baseLead,
    tenant_id: "local",
    config_version_id: "v1",
    request_trace_id: "api-preview-trace",
    run_mode: "preview",
    idempotency_key: "api-preview-idem",
  }, { eventStore });
  assertEqual(eventStore.getEvents(response.execution_id).length, 0, "Preview mode should not write external event store events");
  assertEqual(eventStore.getExecutionSnapshot(response.execution_id), null, "Preview mode should not save snapshot");
  assertEqual(response.replay_metadata.source_used, "memory", "Preview mode should replay from local memory trace");
});

test("v0.7 tenant A cannot access tenant B config", () => {
  const tenantConfigs = {
    tenantA: {
      "tenantA-v1": scoringConfigJson,
    },
    tenantB: {
      "tenantB-v1": scoringConfigJson,
    },
  };
  let blocked = false;
  try {
    scoreLeadAPI({
      lead: baseLead,
      tenant_id: "tenantA",
      config_version_id: "tenantB-v1",
      request_trace_id: "api-tenant-block-trace",
      run_mode: "preview",
    }, { tenantConfigs });
  } catch (error) {
    blocked = true;
  }
  assertEqual(blocked, true, "Tenant A should not access tenant B config");
});

test("v0.7 replay consistency is included in API response", () => {
  const response = scoreLeadAPI({
    lead: baseLead,
    tenant_id: "local",
    config_version_id: "v1",
    request_trace_id: "api-consistency-trace",
    run_mode: "preview",
  });
  assertTrue(Boolean(response.consistency_result), "API response should include consistency_result");
  assertEqual(response.replay_metadata.is_consistent, true, "API replay metadata should include consistency state");
  assertEqual(response.replay_metadata.inconsistency_type, "NONE", "Normal API replay should have no inconsistency");
});

test("v0.7 API idempotency key prevents duplicate execution", () => {
  const eventStore = new FakeEventStore();
  const request = {
    lead: baseLead,
    tenant_id: "local",
    config_version_id: "v1",
    request_trace_id: "api-idem-trace",
    run_mode: "live",
    idempotency_key: "api-idem-shared",
  };
  const first = scoreLeadAPI(request, { eventStore });
  const second = scoreLeadAPI({
    ...request,
    request_trace_id: "api-idem-trace-retry",
  }, { eventStore });
  assertEqual(second.execution_id, first.execution_id, "API idempotency should reuse first execution");
  assertEqual(eventStore.getEvents(first.execution_id).length, 11, "API idempotency should not append duplicate events");
  assertEqual(second.total_score, first.total_score, "API idempotency should return same score");
});

test("v0.7 multi-run same input returns same output", () => {
  const request = {
    lead: baseLead,
    tenant_id: "local",
    config_version_id: "v1",
    request_trace_id: "api-multirun-trace",
    run_mode: "preview",
  };
  const first = scoreLeadAPI(request);
  const second = scoreLeadAPI(request);
  assertEqual(JSON.stringify(first.breakdown), JSON.stringify(second.breakdown), "Multi-run breakdown should match");
  assertEqual(first.total_score, second.total_score, "Multi-run total score should match");
  assertEqual(JSON.stringify(first.explanation), JSON.stringify(second.explanation), "Multi-run explanation should match");
});
