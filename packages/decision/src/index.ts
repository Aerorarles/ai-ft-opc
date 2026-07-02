// @ts-check

/**
 * @typedef {{
 *   action: "HOT" | "WARM" | "COLD",
 *   confidence: number,
 *   reasons: string[],
 *   risk_flags: string[],
 *   next_step: string
 * }} LeadDecision
 */

/**
 * @param {number} value
 * @returns {number}
 */
function clampConfidence(value) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

/**
 * @param {number} v1Score
 * @param {number | null} v2ShadowScore
 * @param {{ email?: string | null, website?: string | null, domain?: string | null, signals?: string[], industry?: string | null }} lead
 * @returns {LeadDecision}
 */
function decideLeadAction(v1Score, v2ShadowScore, lead) {
  const reasons = [];
  const riskFlags = [];
  const signals = Array.isArray(lead.signals) ? lead.signals.map((signal) => String(signal).toLowerCase()) : [];
  const hasFactorySignal = signals.includes("factory");
  const hasEmail = Boolean(lead.email);
  const hasWebsite = Boolean(lead.website || lead.domain);
  const scoreDelta = typeof v2ShadowScore === "number" ? v2ShadowScore - Number(v1Score || 0) : null;

  if (!hasWebsite) {
    reasons.push("missing_website");
    riskFlags.push("no_website");
    return {
      action: "COLD",
      confidence: 0.85,
      reasons,
      risk_flags: riskFlags,
      next_step: "Send to low-priority manual review; do not outreach automatically.",
    };
  }

  if (scoreDelta !== null && scoreDelta >= 15) {
    reasons.push("v2_shadow_score_much_higher_than_v1");
  }

  if (hasEmail && hasFactorySignal) {
    reasons.push("email_and_factory_signal");
  }

  if (signals.includes("trading") && hasFactorySignal) {
    reasons.push("conflicting_factory_and_trading_signals");
    riskFlags.push("conflicting_signals");
    return {
      action: "WARM",
      confidence: 0.62,
      reasons,
      risk_flags: riskFlags,
      next_step: "Human review company type before sales action.",
    };
  }

  if (reasons.includes("v2_shadow_score_much_higher_than_v1") || reasons.includes("email_and_factory_signal")) {
    return {
      action: "HOT",
      confidence: clampConfidence(0.78 + (hasEmail ? 0.08 : 0) + (hasFactorySignal ? 0.08 : 0)),
      reasons,
      risk_flags: riskFlags,
      next_step: "Add to human review queue as high priority.",
    };
  }

  reasons.push("default_review_required");
  return {
    action: "WARM",
    confidence: 0.55,
    reasons,
    risk_flags: riskFlags,
    next_step: "Keep in review queue for manual qualification.",
  };
}

module.exports = {
  decideLeadAction,
};
