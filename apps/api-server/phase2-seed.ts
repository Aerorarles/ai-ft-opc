const { MemoryLeadRepository, MemoryShadowRepository, MemoryReviewRepository } = require("../../packages/persistence/src/index.ts");

function now() {
  return new Date().toISOString();
}

function makeLead(id, company, website, country, industry, hasEmail, hasPhone, score, grade, priority) {
  const timestamp = now();
  return {
    id,
    company_name: company,
    website_summary: website,
    country,
    industry,
    source: "mock_seed",
    has_email: hasEmail,
    has_phone: hasPhone,
    enrichment_status: "succeeded",
    v01_score: score,
    v01_grade: grade,
    v01_priority: priority,
    v01_score_breakdown_summary: { safe_summary: true },
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function createSeedRepositories() {
  return {
    leadRepository: new MemoryLeadRepository(),
    shadowRepository: new MemoryShadowRepository(),
    reviewRepository: new MemoryReviewRepository(),
  };
}

async function seedPhase2(repositories) {
  const leads = [
    makeLead("lead-factory-high", "ABC Displays", "abcdisplays.com", "US", "Retail Display Manufacturing", true, true, 45, "B", "normal"),
    makeLead("lead-trader", "Metro Trading", "metrotrading.com", "US", "Trading Company", true, false, 35, "C", "low"),
    makeLead("lead-no-website", "No Web Lead", null, "DE", "Retail Display Manufacturing", true, false, 20, "C", "low"),
    makeLead("lead-no-contact", "Silent Fixture Co", "silentfixture.com", "US", "Retail Display Manufacturing", false, false, 25, "C", "low"),
    makeLead("lead-big-delta", "Delta Display Works", "deltadisplay.com", "UK", "Retail Display Manufacturing", true, true, 3, "C", "low"),
    makeLead("lead-invalid-config", "Blocked Config Example", "blockedconfig.com", "US", "Retail Display Manufacturing", true, false, 30, "C", "low"),
  ];
  for (const lead of leads) {
    await repositories.leadRepository.seedLeadSnapshot(lead);
  }
  return leads;
}

module.exports = {
  createSeedRepositories,
  seedPhase2,
};
