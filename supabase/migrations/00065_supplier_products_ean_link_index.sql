-- Fix: `supplier_products.ean` je bio potpuno neindeksiran, pa je auto-match
-- "linked offer" korak (loadLinkedOffersByEan u matchSupplierProduct.ts) radio
-- sequential scan cijele tabele za SVAKI artikal tokom importa. Kako tabela
-- raste (8 supplier importera), scan sve sporiji -> "canceling statement due
-- to statement timeout" koji obara cijeli GHA cron job.
--
-- Isti obrazac kao idx_supplier_products_mpn_match_key_linked (00043), samo za
-- EAN — parcijalni indeks tačno na predikatu iz upita
-- (`ean = X AND product_id IS NOT NULL`).

CREATE INDEX IF NOT EXISTS idx_supplier_products_ean_linked
  ON public.supplier_products (ean)
  WHERE ean IS NOT NULL AND product_id IS NOT NULL;
