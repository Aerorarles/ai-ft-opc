CREATE TABLE IF NOT EXISTS candidate_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,

  company_name TEXT,
  website TEXT,
  country TEXT,
  industry TEXT,

  source TEXT NOT NULL,
  source_url TEXT,
  search_query TEXT,

  page_title TEXT,
  page_snippet TEXT,

  candidate_status TEXT NOT NULL DEFAULT 'new',
  relevance_score INTEGER DEFAULT 0,
  review_notes TEXT,

  analysis JSONB DEFAULT '{}'::jsonb,
  raw_data JSONB DEFAULT '{}'::jsonb,

  promoted_to_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_candidate_leads_website_unique
ON candidate_leads (website)
WHERE website IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidate_leads_task_id
ON candidate_leads(task_id);

CREATE INDEX IF NOT EXISTS idx_candidate_leads_product_id
ON candidate_leads(product_id);

CREATE INDEX IF NOT EXISTS idx_candidate_leads_status
ON candidate_leads(candidate_status);

CREATE INDEX IF NOT EXISTS idx_candidate_leads_score
ON candidate_leads(relevance_score DESC);
