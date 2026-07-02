// @ts-check

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeOptionalText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function tokenize(value) {
  const text = normalizeText(value);
  if (!text) {
    return [];
  }

  return text
    .split(/[^a-z0-9]+/i)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Extract stable rule-engine features from a Lead object.
 *
 * company_name is the canonical field. company is accepted only as a legacy
 * compatibility layer so older local demos keep running.
 *
 * @param {import("./types.ts").Lead} lead
 * @returns {import("./types.ts").LeadFeatures}
 */
function extractFeatures(lead) {
  const companyName = String(lead.company_name || lead.company || "").trim();
  const country = normalizeOptionalText(lead.country);
  const industry = normalizeOptionalText(lead.industry);
  const website = normalizeOptionalText(lead.website);
  const email = normalizeOptionalText(lead.email);
  const phone = normalizeOptionalText(lead.phone);
  const industryKeywords = tokenize(lead.industry);
  const signals = Array.isArray(lead.signals)
    ? lead.signals.map(normalizeText).filter(Boolean)
    : [];

  return {
    company_name: companyName,
    website,
    has_email: Boolean(email),
    has_phone: Boolean(phone),
    country,
    industry,
    email,
    phone,
    industry_keywords: industryKeywords,
    signals,
  };
}

/**
 * @param {import("./types.ts").LeadFeatures} features
 * @returns {import("./types.ts").InputSummary}
 */
function buildInputSummary(features) {
  return {
    has_company_name: Boolean(features.company_name),
    has_website: Boolean(features.website),
    has_email: features.has_email,
    has_phone: features.has_phone,
    country: features.country,
    industry_keywords_count: features.industry_keywords.length,
    signals_count: features.signals.length,
  };
}

module.exports = {
  extractFeatures,
  buildInputSummary,
  tokenize,
  normalizeText,
  normalizeOptionalText,
};
