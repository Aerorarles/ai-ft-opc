// @ts-check

/**
 * @typedef {{
 *   company_name?: string,
 *   company?: string,
 *   website?: string,
 *   country?: string,
 *   industry?: string,
 *   email?: string,
 *   phone?: string,
 *   notes?: string,
 *   signals?: string[],
 *   legacy_v01_score?: number
 * }} LeadInput
 */

/**
 * @typedef {{
 *   id: string,
 *   company_name: string,
 *   website: string | null,
 *   domain: string | null,
 *   country: string | null,
 *   industry: string | null,
 *   email: string | null,
 *   phone: string | null,
 *   notes: string | null,
 *   signals: string[],
 *   legacy_v01_score: number
 * }} LeadNormalized
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

/**
 * @param {string} name
 * @returns {string}
 */
function normalizeCompanyName(name) {
  return cleanText(name)
    .replace(/[.,]+$/g, "")
    .replace(/\b(inc|llc|ltd|limited|corp|corporation|co)\.?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string | undefined} website
 * @returns {string | null}
 */
function extractDomain(website) {
  const raw = cleanText(website);
  if (!raw) return null;
  const withoutProtocol = raw.replace(/^https?:\/\//i, "");
  const host = withoutProtocol.split("/")[0].split("?")[0].split("#")[0].toLowerCase();
  const cleaned = host.replace(/^www\./, "");
  if (!cleaned || !cleaned.includes(".") || cleaned.endsWith(".invalid")) return null;
  return cleaned;
}

/**
 * @param {LeadInput} input
 * @param {string | null} domain
 * @returns {string | null}
 */
function guessCountry(input, domain) {
  const country = cleanText(input.country);
  if (country) return country.toUpperCase();
  if (!domain) return null;
  if (domain.endsWith(".uk")) return "UK";
  if (domain.endsWith(".de")) return "DE";
  if (domain.endsWith(".cn")) return "CN";
  if (domain.endsWith(".ca")) return "CA";
  if (domain.endsWith(".com") || domain.endsWith(".us")) return "US";
  return null;
}

/**
 * @param {LeadInput} input
 * @returns {string | null}
 */
function mapIndustry(input) {
  const source = `${input.industry || ""} ${input.notes || ""} ${input.company_name || input.company || ""}`.toLowerCase();
  if (/display|fixture|signage|acrylic|retail/.test(source)) return "Retail Display Manufacturing";
  if (/factory|manufacturer|manufacturing|plant/.test(source)) return "Manufacturing";
  if (/trading|import|export|sourcing/.test(source)) return "Trading Company";
  if (/packaging|box|carton/.test(source)) return "Packaging";
  return cleanText(input.industry) || null;
}

/**
 * @param {LeadInput} input
 * @returns {string[]}
 */
function normalizeSignals(input) {
  const values = Array.isArray(input.signals) ? input.signals : [];
  const notes = cleanText(input.notes).toLowerCase();
  const inferred = [];
  if (/factory|manufacturer|plant/.test(notes)) inferred.push("factory");
  if (/export|import/.test(notes)) inferred.push("export");
  if (/display|fixture|signage/.test(notes)) inferred.push("display");
  return [...new Set([...values, ...inferred].map((value) => cleanText(value).toLowerCase()).filter(Boolean))];
}

/**
 * @param {LeadInput} input
 * @returns {LeadNormalized}
 */
function normalizeLead(input) {
  const companyName = normalizeCompanyName(input.company_name || input.company || "Unknown Company");
  const domain = extractDomain(input.website);
  return {
    id: `lead-${Buffer.from(`${companyName}|${domain || ""}`).toString("hex").slice(0, 16)}`,
    company_name: companyName,
    website: cleanText(input.website) || null,
    domain,
    country: guessCountry(input, domain),
    industry: mapIndustry(input),
    email: cleanText(input.email) || null,
    phone: cleanText(input.phone) || null,
    notes: cleanText(input.notes) || null,
    signals: normalizeSignals(input),
    legacy_v01_score: Number.isFinite(input.legacy_v01_score) ? Number(input.legacy_v01_score) : 0,
  };
}

module.exports = {
  normalizeLead,
  normalizeCompanyName,
  extractDomain,
  guessCountry,
  mapIndustry,
};
