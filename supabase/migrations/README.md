# Tech Zone – Supabase migrations

## Apply Phase 1 schema

**Option A – Supabase Dashboard (no DATABASE_URL needed)**

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/bxicebgwhwgtofdxnkks/sql/new).
2. Paste the contents of `00001_tech_zone_phase1_schema.sql`.
3. Click **Run**. You should see “Success. No rows returned.”
4. In **Table Editor**, confirm: `suppliers`, `categories`, `products`, `supplier_products`, `product_images`.

**Option B – From this repo (requires DATABASE_URL)**

1. In Supabase: **Project Settings → Database**. Copy the **Connection string** (URI).
2. Add to `.env.local`: `DATABASE_URL=<paste-connection-string>`.
3. Run: `node scripts/run-phase1-schema.js`
