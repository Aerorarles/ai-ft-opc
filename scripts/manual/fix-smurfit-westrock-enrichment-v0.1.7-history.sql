-- 本脚本仅用于修正 Smurfit Westrock 技术测试 Lead 的 v0.1.4 历史污染。
-- 必须在用户明确授权，并先完成只读预检后，才可手动取消注释并执行正式修正 SQL。
-- 若正式 UPDATE 返回 0 行，必须立即停止并人工核对，不得修改 SQL 条件后重试。
-- 本脚本不处理 raw_data，raw_data.enrichment_v01 将由后续已验证的 v0.1.7 单条安全回写更新。
-- 该 Lead 仅用于 Lead Enrichment 正向技术测试，禁止任何触达、开发信、销售跟进或批量处理。

-- 只读预检：默认可安全执行，不写入任何数据。
SELECT
  id,
  company_name,
  phone,
  contact_name,
  contact_page_url,
  enrichment_status,
  updated_at
FROM public.leads
WHERE id = 'cdabf717-3c57-4586-befa-c5ee66953547'::uuid;

-- 正式修正 SQL：默认不得执行。
-- 执行前必须取消下方注释，并再次取得用户明确确认。
-- 要求三个旧值全部严格匹配；若任一值已变化，UPDATE 必须影响 0 行，不得部分修正。
/*
BEGIN;

UPDATE public.leads
SET
  phone = NULL,
  contact_name = NULL,
  contact_page_url = 'https://www.smurfitwestrock.com/contact'
WHERE id = 'cdabf717-3c57-4586-befa-c5ee66953547'::uuid
  AND phone = '2026052712'
  AND contact_name = 'Packaging Industrial'
  AND contact_page_url = 'https://www.smurfitwestrock.com/products/packaging/food-contact'
RETURNING
  id,
  company_name,
  phone,
  contact_name,
  contact_page_url,
  updated_at;

COMMIT;
*/

-- 回滚 SQL 模板：默认不得执行。
-- 仅用于本次修正后发现问题时，并且必须再次取得用户明确确认。
-- 回滚范围严格限定同一个 Lead UUID。
/*
BEGIN;

UPDATE public.leads
SET
  phone = '2026052712',
  contact_name = 'Packaging Industrial',
  contact_page_url = 'https://www.smurfitwestrock.com/products/packaging/food-contact'
WHERE id = 'cdabf717-3c57-4586-befa-c5ee66953547'::uuid
RETURNING
  id,
  company_name,
  phone,
  contact_name,
  contact_page_url,
  updated_at;

COMMIT;
*/
