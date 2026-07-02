// @ts-check

if (typeof require !== "undefined" && require.extensions && !require.extensions[".ts"]) {
  require.extensions[".ts"] = require.extensions[".js"];
}

const { previewLeadScore } = require("./preview.ts");
const scoringConfigJson = require("../../scoring-config/v1.json");

const lead = {
  company_name: "ABC Displays",
  country: "US",
  industry: "Retail Display Manufacturing",
  email: "info@abc.com",
  phone: "+1 555 0100",
  signals: ["factory", "export", "display"],
};

const preview = previewLeadScore(lead, scoringConfigJson);

console.log("config_version:", preview.config_version);
console.log("is_config_valid:", preview.is_config_valid);
console.log("total_score:", preview.score_result.total_score);
console.log("score_delta_summary:", JSON.stringify(preview.score_delta_summary, null, 2));
console.log("human_readable_summary:", preview.human_readable_summary);
