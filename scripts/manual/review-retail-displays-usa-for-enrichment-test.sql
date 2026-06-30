-- 人工审核专用脚本：将指定候选客户从 low_priority 调整为 review。
-- 该调整仅用于 Lead Enrichment 正向技术测试，不代表允许真实开发、自动触达或任何外部联系。
-- 执行前必须由人工确认目标候选记录、公司类型、官网可访问性和测试边界。

UPDATE public.candidate_leads
SET
  candidate_status = 'review',
  review_notes = CONCAT(
    COALESCE(review_notes, ''),
    CASE
      WHEN COALESCE(review_notes, '') = '' THEN ''
      ELSE E'\n'
    END,
    'Manual review: Retail display system integrator / possible channel or upstream supply opportunity. Public website and Contact page are accessible. Approved for Lead Enrichment positive technical test only. No outreach until company type and sourcing model are manually confirmed.'
  )
WHERE id = '9d724526-bd22-45c8-97e4-df052800ae204'::uuid
  AND candidate_status = 'low_priority'
  AND promoted_to_lead_id IS NULL
RETURNING
  id,
  company_name,
  website,
  candidate_status,
  review_notes;
