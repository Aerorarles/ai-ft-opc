const { normalizeLead } = require("../../packages/ingestion/src/index.ts");
const { isDuplicate } = require("../../packages/dedup/src/index.ts");
const { decideLeadAction } = require("../../packages/decision/src/index.ts");
const { ReviewQueue } = require("../../packages/review-queue/src/index.ts");
const { Phase1Store, createPhase1Api, runPhase1Pipeline } = require("./phase1-api.ts");

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(condition, message) {
  if (!condition) throw new Error(message);
}

const tests = [
  {
    name: "ingestion correctness",
    run: () => {
      const lead = normalizeLead({ company_name: " ABC Displays LLC ", website: "https://www.abcdisplays.com/path", notes: "factory display", email: "info@example.test" });
      assertEqual(lead.company_name, "ABC Displays", "Company name should normalize");
      assertEqual(lead.domain, "abcdisplays.com", "Domain should extract");
      assertEqual(lead.country, "US", "Country should be guessed from .com");
      assertEqual(lead.industry, "Retail Display Manufacturing", "Industry should map");
      assertTrue(lead.signals.includes("factory"), "Factory signal should infer");
    },
  },
  {
    name: "dedup correctness",
    run: () => {
      const a = normalizeLead({ company_name: "ABC Displays", website: "https://abcdisplays.com" });
      const b = normalizeLead({ company_name: "ABC Displays LLC", website: "https://www.abcdisplays.com/about" });
      const result = isDuplicate(a, b);
      assertEqual(result.duplicate, true, "Same domain should deduplicate");
      assertEqual(result.reason, "same_domain", "Dedup reason should be same domain");
    },
  },
  {
    name: "decision output correctness",
    run: () => {
      const lead = normalizeLead({ company_name: "Factory Lead", website: "https://factory.com", email: "info@example.test", signals: ["factory"] });
      const decision = decideLeadAction(5, 25, lead);
      assertEqual(decision.action, "HOT", "Factory lead with email and higher v2 should be HOT");
      assertTrue(decision.reasons.length > 0, "Decision should include reasons");
    },
  },
  {
    name: "review queue state transitions",
    run: () => {
      const queue = new ReviewQueue();
      const item = queue.addToQueue({ id: "lead-1" }, { action: "HOT" });
      assertEqual(item.status, "pending", "New review item should be pending");
      const approved = queue.approveLead(item.id, "approved for test");
      assertEqual(approved.status, "approved", "Review item should approve");
    },
  },
  {
    name: "API endpoints return valid JSON",
    run: async () => {
      const api = createPhase1Api();
      const ingest = await api.request("POST", "/lead/ingest", {
        company_name: "ABC Displays",
        website: "https://abcdisplays.com",
        country: "US",
        industry: "Retail Display Manufacturing",
        email: "info@example.test",
        signals: ["factory", "display"],
        legacy_v01_score: 5,
      });
      assertEqual(ingest.status, 201, "Ingest should create lead");
      assertTrue(Boolean(ingest.json.record.id), "Ingest should return record id");
      const fetched = await api.request("GET", `/lead/${ingest.json.record.id}`);
      assertEqual(fetched.status, 200, "GET lead should work");
      const decided = await api.request("POST", "/lead/decide", { lead_id: ingest.json.record.id });
      assertEqual(decided.status, 200, "Decide endpoint should work");
      const reviewed = await api.request("POST", "/lead/review", { review_item_id: ingest.json.record.review_item_id, action: "approve" });
      assertEqual(reviewed.status, 200, "Review endpoint should work");
      const leads = await api.request("GET", "/leads");
      assertEqual(leads.status, 200, "List leads should work");
      assertTrue(Array.isArray(leads.json), "List leads should return JSON array");
    },
  },
  {
    name: "end-to-end pipeline works",
    run: () => {
      const store = new Phase1Store();
      const result = runPhase1Pipeline(store, [
        { company_name: "ABC Displays", website: "https://abcdisplays.com", country: "US", industry: "Retail Display Manufacturing", email: "info@example.test", signals: ["factory", "display"], legacy_v01_score: 5 },
        { company_name: "ABC Displays LLC", website: "https://www.abcdisplays.com", country: "US", industry: "Retail Display Manufacturing", signals: ["display"], legacy_v01_score: 5 },
        { company_name: "No Web Lead", country: "US", industry: "Trading Company", legacy_v01_score: 0 },
      ]);
      assertEqual(result.total_leads_processed, 3, "Pipeline should process all inputs");
      assertEqual(result.duplicates_removed, 1, "Pipeline should remove duplicate");
      assertEqual(store.reviewQueue.list().length, 2, "Pipeline should enqueue non-duplicates");
    },
  },
];

async function main() {
  for (const test of tests) {
    try {
      await test.run();
      console.log(`PASS ${test.name}`);
    } catch (error) {
      console.error(`FAIL ${test.name}`);
      console.error(error && error.message ? error.message : error);
      process.exitCode = 1;
    }
  }
  if (!process.exitCode) {
    console.log("✔ ingestion working");
    console.log("✔ dedup working");
    console.log("✔ decision working");
    console.log("✔ review queue working");
    console.log("✔ api working");
  }
}

main();
