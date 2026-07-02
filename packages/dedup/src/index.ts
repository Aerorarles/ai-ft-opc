// @ts-check

/**
 * @typedef {{
 *   duplicate: boolean,
 *   reason: "same_domain" | "similar_company_name" | "not_duplicate",
 *   confidence: number
 * }} DedupResult
 */

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|limited|corp|corporation|co|company)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
function stringSimilarity(left, right) {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const leftWords = new Set(a.split(" "));
  const rightWords = new Set(b.split(" "));
  const intersection = [...leftWords].filter((word) => rightWords.has(word)).length;
  const union = new Set([...leftWords, ...rightWords]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * @param {{ company_name?: string, domain?: string | null }} leadA
 * @param {{ company_name?: string, domain?: string | null }} leadB
 * @returns {DedupResult}
 */
function isDuplicate(leadA, leadB) {
  if (leadA.domain && leadB.domain && leadA.domain === leadB.domain) {
    return { duplicate: true, reason: "same_domain", confidence: 1 };
  }

  const similarity = stringSimilarity(leadA.company_name || "", leadB.company_name || "");
  if (similarity >= 0.75) {
    return { duplicate: true, reason: "similar_company_name", confidence: Math.round(similarity * 100) / 100 };
  }

  return { duplicate: false, reason: "not_duplicate", confidence: Math.round(similarity * 100) / 100 };
}

module.exports = {
  isDuplicate,
  stringSimilarity,
};
