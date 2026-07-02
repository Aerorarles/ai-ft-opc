// @ts-check

if (typeof require !== "undefined" && require.extensions && !require.extensions[".ts"]) {
  require.extensions[".ts"] = require.extensions[".js"];
}

const { scoreLead } = require("./engine.ts");
const { loadConfig } = require("./config.ts");
const scoringConfigJson = require("../../scoring-config/v1.json");

const lead = {
  company_name: "ABC Displays",
  country: "US",
  industry: "Retail Display Manufacturing",
  email: "info@abc.com",
  signals: ["factory", "export", "display"],
};

const config = loadConfig(scoringConfigJson);
const result = scoreLead(lead, config);

console.log("total_score:", result.total_score);
console.log("breakdown:", JSON.stringify(result.breakdown, null, 2));
console.log("applied_rules:", JSON.stringify(result.applied_rules, null, 2));
console.log("evaluation_warnings:", JSON.stringify(result.evaluation_warnings, null, 2));
console.log("input_summary:", JSON.stringify(result.input_summary, null, 2));
