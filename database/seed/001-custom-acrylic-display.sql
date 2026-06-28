INSERT INTO products (
  name,
  category,
  description,
  target_countries,
  target_industries,
  status
)
SELECT
  'Custom Acrylic Display',
  'Custom Display & Signage',
  'Factory-direct custom acrylic display manufacturing with UV printing, screen printing, laser cutting, CNC cutting, fast samples, and small-batch support.',
  '["United States","Canada","United Kingdom","Australia","Germany"]'::jsonb,
  '["Retail displays","Cosmetics and beauty brands","Jewelry brands","Food and beverage brands","Hotels and restaurants","Trade show and event companies","Signage distributors","Promotional product distributors"]'::jsonb,
  'active'
WHERE NOT EXISTS (
  SELECT 1
  FROM products
  WHERE name = 'Custom Acrylic Display'
);
