-- Batch update products.price from aggregation (Phase 1 pricing engine).
-- RPC used by lib/pricing/aggregate-prices to avoid N+1 updates.
-- entries: jsonb array of { "id": "uuid", "price": number }

CREATE OR REPLACE FUNCTION update_products_prices(entries jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE products p
  SET price = (elem->>'price')::numeric, updated_at = now()
  FROM jsonb_array_elements(entries) AS elem
  WHERE p.id = (elem->>'id')::uuid;
$$;
