// @ts-check

if (typeof require !== "undefined" && require.extensions && !require.extensions[".ts"]) {
  require.extensions[".ts"] = require.extensions[".js"];
}

const { loadConfig } = require("./config.ts");
const { scoreLead } = require("./engine.ts");
const { getEvents } = require("./execution-trace-store.ts");
const { replayExecution } = require("./replay.ts");
const scoringConfigJson = require("../../scoring-config/v1.json");

const lead = {
  company_name: "ABC Displays",
  country: "US",
  industry: "Retail Display Manufacturing",
  email: "present",
  phone: "present",
  website: "https://abcdisplays.example",
  signals: ["factory", "export", "display"],
};

const config = loadConfig(scoringConfigJson);
const result = scoreLead(lead, config, {
  trigger_source: "manual",
  run_mode: "preview",
  tenant_id: "local",
});
const events = getEvents(result.execution_context.execution_id);
const replay = replayExecution(result.execution_context.execution_id);

console.log("execution_id:", result.execution_context.execution_id);
console.log("event_count:", events.length);
console.log("timeline:");
for (const event of events) {
  const parts = [
    `#${event.sequence_index}`,
    event.event_type,
  ];
  if ("rule_id" in event) {
    parts.push(`rule=${event.rule_id}`);
  }
  if (event.event_type === "dimension_score_update") {
    parts.push(`dimension=${event.dimension}`);
    parts.push(`running_total=${event.running_total}`);
  }
  if (event.event_type === "final_score") {
    parts.push(`total_score=${event.total_score}`);
  }
  console.log(parts.join(" "));
}
console.log("replay_consistency:", replay.is_consistent);
console.log("recomputed_total_score:", replay.recomputed_total_score);
console.log("consistency_errors:", JSON.stringify(replay.consistency_errors));
