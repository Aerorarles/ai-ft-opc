-- 人工审核专用脚本：将指定候选客户从 low_priority 调整为 competitor_review。
-- 该公司属于同行或竞争方，仅允许作为 Lead Enrichment 正向技术测试样本。
-- 禁止自动触达、开发信、销售跟进或批量处理。
-- 执行前必须由人工确认目标候选记录、官网可访问性、Contact 页面和测试边界。

UPDATE public.candidate_leads
SET
  candidate_status = 'competitor_review',
  review_notes = CONCAT(
    COALESCE(review_notes, ''),
    CASE
      WHEN COALESCE(review_notes, '') = '' THEN ''
      ELSE E'\n'
    END,
    'Manual review: competitor website is publicly accessible and has a Contact page. Approved only as a positive Lead Enrichment technical test sample. No outreach, sales follow-up, or automated contact.'
  )
WHERE id = '8e3cef84-b403-4054-b36c-ebc72d54e876'::uuid
  AND candidate_status = 'low_priority'
  AND promoted_to_lead_id IS NULL
RETURNING
  id,
  company_name,
  website,
  candidate_status,
  review_notes;
