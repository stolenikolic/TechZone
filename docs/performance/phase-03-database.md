# Faza 03 — indeksi i uži listing, bez nove tabele

Migracija se piše lokalno i ne primjenjuje se iz ovog zadatka na produkciju dok SQL ne prođe reviziju. Ime fajla dolazi iz `supabase migration new listing_and_homepage_indexes`.

Prije indeksa pročitaj postojeće, da ne dupliraš:

```sql
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_products_flash_visible',
    'idx_products_featured_visible',
    'idx_product_images_product_sort'
  );
```

## 3.1 Indeksi

`CREATE INDEX CONCURRENTLY` ne smije u migraciju koju Supabase CLI izvršava unutar transakcije. Zato obični `CREATE INDEX`. Tabela `products` je 251 MB; kraći lock je prihvatljiv van špice. U komentaru migracije napiši da se pušta van uvoza (ne u isto vrijeme kad `price-sync.yml`, cron `0 */4 * * *`, ni nightly `30 20 * * *` UTC).

```sql
CREATE INDEX IF NOT EXISTS idx_products_flash_visible
  ON public.products (created_at DESC)
  WHERE is_active = true AND publish_locked = false AND is_flash_deal = true;

CREATE INDEX IF NOT EXISTS idx_products_featured_visible
  ON public.products (created_at DESC)
  WHERE is_active = true AND publish_locked = false AND is_featured = true;

CREATE INDEX IF NOT EXISTS idx_product_images_product_sort
  ON public.product_images (product_id, sort_order);
```

Ne dodaj expression indeks nad `product_effective_price(custom_price, price)` u ovoj fazi. Funkcija je IMMUTABLE, ali sort i dalje nosi featured prioritet, pa indeks sam ne uklanja sort cijele kategorije. To je kasnija faza 06 zajedno sa facet kešom.

Poslije indeksa, ručno, van migracije, jednom:

```sql
ANALYZE public.products;
ANALYZE public.product_attributes;
ANALYZE public.product_images;
```

`product_attributes` je u auditu imala `n_live_tup = 0` i `last_autoanalyze` null, iako `count(*)` vraća 265041. Planner za nju je slijep dok se ANALYZE ne odradi. ANALYZE je read-write za statistiku, nije izmjena šeme. Neka je pokrene čovjek u SQL editoru, ne aplikacija pri svakom startu.

## 3.2 Listing RPC bez `description`

Živa funkcija `get_category_products_listing` (provjereno na bazi 2026-11-24) vraća `description` i nosi ga kroz sort. Za `foto-i-video-pribor` sort cijene je na toplom kešu i dalje pisao temp fajl (`temp written=337`) jer je `work_mem` 2184 kB.

Izmijeni funkciju `CREATE OR REPLACE` tako da:

- `RETURNS TABLE` više nema `description`
- CTE `filtered` ne bira `p.description`
- završni SELECT ne bira `r.description`
- ostali parametri, filteri, `count(*) OVER ()`, OFFSET i sort ostaju identični

Zatim u `src/lib/shop/category-listing-sql.ts` ukloni `description` iz tipa reda. U `toProduct` u `shop-category-listing.ts` ne čitaj `row.description`. Ako kartica traži polje, proslijedi `""`.

Ne mijenjaj `p_page_size` cap 100 ni `LISTING_PAGE_SIZE` 30.

`GRANT EXECUTE` ostaje samo `service_role`, kao danas. Ne dodaj `anon`.

## 3.3 Šta se ne dira

- `pg_trgm` indeksi i `products.search_vector` postoje u bazi, a nisu u migracijama repoa. Nemoj ih dropati. Nemoj pisati trigger za `search_vector` u ovoj fazi; pretraga ga ne čita. Faza 06 koristi postojeće trigram indekse.
- Nema RLS izmjena. Katalog danas nema RLS. Uključivanje RLS na `products` nije dio performansi i može ugasiti shop.
- `search_products` RPC ostaje. Aplikacija ga ne zove. Ne briši ga u ovoj fazi.

## Provjera

Pokreni tri `EXPLAIN (ANALYZE, BUFFERS)` iz `MEASUREMENT_PROTOCOL.md` odjeljak 2, svaki dvaput. Drugi prolaz je broj koji se upoređuje.

Očekivanje drugog prolaza:

- flash i featured: Index Scan na novom parcijalnom indeksu, ispod 50 ms, 0 redova dok su brojači nula
- listing `kucista` stranica 1 sort `asc`: nema `temp written`, ispod 80 ms
- PDP slug i dalje Index Scan na `products_slug_key` (već 2 ms; ne smije se pogoršati)

## Rollback

Nova migracija koja radi `DROP INDEX IF EXISTS` za tri imena i vraća prethodni `CREATE OR REPLACE` sa `description`. Vrati i TypeScript tip. Stari redovi podataka se ne mijenjaju.

## Rizik

`CREATE INDEX` uzima `SHARE` lock kratko na Next.js 16 / Postgres 17 standardnom `CREATE INDEX` (ne concurrently), što blokira upise u `products` dok se indeks gradi. Zato van sync crona. Ako `CREATE OR REPLACE` promijeni potpis a PostgREST kešira šemu, sačekaj reload šeme ili `NOTIFY pgrst, 'reload schema'`.
