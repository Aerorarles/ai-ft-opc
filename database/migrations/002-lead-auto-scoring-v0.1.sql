CREATE OR REPLACE FUNCTION score_lead_v01()
RETURNS TRIGGER AS $$
DECLARE
  v_target_countries JSONB;
  v_target_industries JSONB;
  v_industry_score INTEGER := 0;
  v_company_score INTEGER := 0;
  v_contact_score INTEGER := 0;
  v_signal_score INTEGER := 0;
  v_market_score INTEGER := 0;
  v_total INTEGER := 0;
  v_exact_industry BOOLEAN := FALSE;
  v_exact_country BOOLEAN := FALSE;
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    SELECT target_countries, target_industries
    INTO v_target_countries, v_target_industries
    FROM products
    WHERE id = NEW.product_id;

    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(v_target_industries, '[]'::jsonb)) AS item(value)
      WHERE lower(trim(item.value)) = lower(trim(COALESCE(NEW.industry, '')))
    )
    INTO v_exact_industry;

    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(v_target_countries, '[]'::jsonb)) AS item(value)
      WHERE lower(trim(item.value)) = lower(trim(COALESCE(NEW.country, '')))
    )
    INTO v_exact_country;
  END IF;

  IF v_exact_industry THEN
    v_industry_score := 30;
  END IF;

  IF NULLIF(trim(COALESCE(NEW.website, '')), '') IS NOT NULL THEN
    v_company_score := v_company_score + 10;
  END IF;

  IF lower(COALESCE(NEW.company_size, '')) IN
    ('11-50', '51-200', '201-500', '501-1000', '1000+') THEN
    v_company_score := v_company_score + 10;
  END IF;

  IF NULLIF(trim(COALESCE(NEW.email, '')), '') IS NOT NULL THEN
    v_contact_score := v_contact_score + 10;
  END IF;

  IF lower(COALESCE(NEW.contact_title, '')) ~
    '(purchas|sourc|buyer|owner|marketing|product)' THEN
    v_contact_score := v_contact_score + 10;
  END IF;

  IF jsonb_typeof(COALESCE(NEW.import_signals, '[]'::jsonb)) = 'array'
     AND jsonb_array_length(COALESCE(NEW.import_signals, '[]'::jsonb)) > 0 THEN
    v_signal_score := v_signal_score + 10;
  END IF;

  IF lower(COALESCE(NEW.notes, '')) ~
    '(display|acrylic|custom|uv print|screen print|signage)' THEN
    v_signal_score := v_signal_score + 10;
  END IF;

  IF v_exact_country THEN
    v_market_score := 10;
  END IF;

  v_total := v_industry_score + v_company_score + v_contact_score + v_signal_score + v_market_score;

  NEW.score := v_total;
  NEW.lead_score_breakdown := jsonb_build_object(
    'industry_fit', v_industry_score,
    'company_quality', v_company_score,
    'contactability', v_contact_score,
    'purchase_signal', v_signal_score,
    'market_fit', v_market_score
  );
  NEW.last_scored_at := NOW();

  IF v_total >= 70 THEN
    NEW.grade := 'A';
    NEW.priority := 'high';
  ELSIF v_total >= 40 THEN
    NEW.grade := 'B';
    NEW.priority := 'normal';
  ELSE
    NEW.grade := 'C';
    NEW.priority := 'low';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_score_v01 ON leads;

CREATE TRIGGER leads_score_v01
BEFORE INSERT OR UPDATE OF
  product_id, country, industry, website, company_size,
  email, contact_title, import_signals, notes
ON leads
FOR EACH ROW
EXECUTE FUNCTION score_lead_v01();
