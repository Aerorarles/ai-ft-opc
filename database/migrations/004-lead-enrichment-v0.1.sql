BEGIN;

-- 为 Lead Agent 信息补全能力增加字段，仅追加字段，不修改或删除现有字段、数据、Trigger、索引或约束。
ALTER TABLE public.leads
  ADD COLUMN company_description text,
  ADD COLUMN contact_page_url text,
  ADD COLUMN enrichment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN enriched_at timestamptz,
  ADD COLUMN enrichment_error text;

-- 限制补全状态只能使用明确约定的状态值，便于人工审核、失败重试和后续交付维护。
ALTER TABLE public.leads
  ADD CONSTRAINT leads_enrichment_status_check
  CHECK (
    enrichment_status IN (
      'pending',
      'running',
      'succeeded',
      'partial',
      'failed',
      'skipped'
    )
  );

-- 支持按补全状态筛选待处理、失败或需人工复核的 Lead。
CREATE INDEX idx_leads_enrichment_status
  ON public.leads (enrichment_status);

COMMIT;
