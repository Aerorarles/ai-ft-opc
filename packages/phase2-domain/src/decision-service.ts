// @ts-check

const { decideLeadAction } = require("../../decision/src/index.ts");

/**
 * @param {import("./types.ts").ExistingLeadSnapshot} lead
 * @param {number | null} shadowScore
 */
function decidePhase2Lead(
  lead,
  shadowScore,
  options: { replayConsistency?: boolean; blocked?: boolean; scoreDeltaThreshold?: number } = {},
) {
  const settings = options || {};
  const leadForDecision = {
    website: lead.website_summary,
    domain: lead.website_summary,
    email: lead.has_email ? "present" : null,
    signals: [
      lead.industry && /factory|manufacturing|display/i.test(lead.industry) ? "factory" : "",
      lead.industry && /trading/i.test(lead.industry) ? "trading" : "",
    ].filter(Boolean),
    industry: lead.industry,
  };
  const base = decideLeadAction(lead.v01_score, shadowScore, leadForDecision);
  const riskFlags = [...base.risk_flags];
  const reasons = [...base.reasons];
  const threshold = settings.scoreDeltaThreshold || 15;
  const scoreDelta = typeof shadowScore === "number" ? shadowScore - lead.v01_score : null;

  if (!lead.has_email && !lead.has_phone && !riskFlags.includes("missing_contactability")) {
    riskFlags.push("missing_contactability");
  }
  if (!lead.website_summary && !riskFlags.includes("missing_website")) {
    riskFlags.push("missing_website");
  }
  if (scoreDelta !== null && Math.abs(scoreDelta) >= threshold) {
    reasons.push("large_v01_v02_score_delta");
  }
  if (settings.replayConsistency === false) {
    riskFlags.push("replay_inconsistency");
  }
  if (settings.blocked) {
    return {
      action: "WARM",
      confidence: 0.4,
      reasons: [...new Set([...reasons, "shadow_blocked"])],
      risk_flags: [...new Set(riskFlags)],
      next_step: "Review configuration or input before any follow-up",
    };
  }
  if (settings.replayConsistency === false && base.action === "HOT") {
    return {
      ...base,
      action: "WARM",
      confidence: Math.min(base.confidence, 0.5),
      reasons: [...new Set(reasons)],
      risk_flags: [...new Set(riskFlags)],
      next_step: "Review replay inconsistency before any follow-up",
    };
  }
  return {
    ...base,
    reasons: [...new Set(reasons)],
    risk_flags: [...new Set(riskFlags)],
  };
}

module.exports = { decidePhase2Lead };
