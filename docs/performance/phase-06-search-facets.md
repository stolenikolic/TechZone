# Faza 06 — pretraga i facete prije ikakvog šireg prefetcha

Radi se tek kad faza 04 postoji, jer će se poslije synca morati osvježiti nova keš tabela.

## 6.1 Facete: zašto

`get_category_shop_facets('kucista')` je 2026-11-24 trajao 1193 ms iako je skoro cijeli buffer bio `shared hit`. Kategorija ima 1286 vidljivih proizvoda i 20229 atributa. Funkcija radi nested loop na `product_attributes` i `jsonb_agg` svih vrijednosti.

`foto-i-video-pribor` ima 6473 proizvoda i 0 atributa. Hladan poziv 3277 ms (`shared read` 2596), topli 99 ms. To je I/O Micro instance (`shared_buffers` 224 MB, heap `products` 139 MB, cache hit ratio tabele `products` 88%), ne loš plan sam po sebi. Listing te kategorije je na toplom kešu 82–473 ms i već je prihvatljiv u odnosu na facete.

UI i dalje treba min/max cijenu, listu brendova i vrijednosti atributa. Ne treba svaki ponovljeni red.

## 6.2 Tabela

Nova migracija `supabase migration new category_facet_cache`:

```sql
CREATE TABLE public.category_shop_facet_cache (
  category_id uuid PRIMARY KEY REFERENCES public.categories(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.category_shop_facet_cache ENABLE ROW LEVEL SECURITY;
-- namjerno nema policy: anon/authenticated nemaju pristup; puni je samo vlasnik i service role
```

Ne daj `GRANT` za `anon`. Service role zaobilazi RLS.

Zamijeni tijelo `get_category_shop_facets` ovim redom, zadržavajući isto ime, argument `uuid` i `RETURNS jsonb`, `STABLE`, `SECURITY DEFINER`, `search_path = public`:

1. Ako postoji red i `refreshed_at > now() - interval '6 hours'`, vrati `payload`.
2. Inače izračunaj isti JSON kao danas, ali agregacije neka budu `DISTINCT` brend i `GROUP BY attribute_id, trim(value)` sa `count(*)`. JSON oblik koji app već parsira mora ostati kompatibilan. Prije izmjene pročitaj `buildCategoryFiltersPayload` / `fetchCategoryFacetsViaSql` i zapiši tačna polja (`price_min`, `price_max`, `brands`, `attribute_values`). Ako app očekuje niz `{attribute_id, value}` bez counta, vrati taj niz iz grupisanog upita (`jsonb_agg(jsonb_build_object('attribute_id', attribute_id, 'value', value))`), ne 20.000 duplikata.
3. `INSERT ... ON CONFLICT (category_id) DO UPDATE` payload i `refreshed_at`.
4. Vrati payload.

Prvi posjet kategoriji i dalje može trajati oko sekunde. Svaki sljedeći u 6 h čita jedan red. To je svjesno. Ne računaj facete u requestu ako je keš svjež.

Dodaj `refresh_category_shop_facets(p_category_id uuid)` koja briše red (ili postavlja `refreshed_at` na `-infinity`) da sljedeći čitalac ponovo izračuna. Ne računaj unutar sync joba 129 puta punu agregaciju ako se promijenilo 20 proizvoda: obriši keš samo za `category_id` tih proizvoda.

Poziv brisanja ide u isti helper kao faza 04, prije HTTP revalidacije, za kategorije iz promijenjenih proizvoda (cap 50 kategorija po jobu; ako ih je više, `DELETE FROM category_shop_facet_cache` bez where, jednom).

Noćni puni aggregate na kraju radi `DELETE FROM category_shop_facet_cache`. Sljedeći posjet kategorije je hladan jednom. To je jeftinije od računanja 129 agregacija u jobu koji već zna timeoutovati.

## 6.3 Pretraga

Danas `src/lib/search/search-listing.ts`: `ROW_PAGE_SIZE = 1000`, petlja dok ne povuče sve pogodke, facete i sort u JS-u, `PER_PAGE = 30`. `pretraga/page.tsx` je `force-dynamic`. Trigram GIN indeksi `products_name_trgm_idx`, `products_brand_trgm_idx`, `products_mpn_trgm_idx`, `products_ean_trgm_idx` već postoje u bazi. Jedan `EXPLAIN` za `%logitech%` AND `%mis%` bio je Bitmap Index Scan, 219 ms, 0 redova. Problem nije „nema indeksa“. Problem je što app povlači cijeli skup prije prikaza 30 redova, a kratki tokeni (`%a%`) i dalje mogu biti skupi.

Ne koristi stari RPC `search_products`. On radi `position()` nad spojenim tekstom, ne gleda `publish_locked`, i nije ono što UI zove.

Nova funkcija `search_storefront` u istoj migraciji:

- argumenti: `p_tokens text[]`, `p_page int`, `p_page_size int`, `p_sort text`, `p_category_id uuid` (nullable)
- `p_page_size` se reže na 30
- tokeni: najviše 5, svaki poslije trim-a duži od 1 znaka; inače prazan rezultat, ne pun scan
- svaki token je AND: `(name ILIKE '%'||token||'%' OR brand ILIKE ... OR mpn ILIKE ... OR ean ILIKE ...)`
- `is_active` i `NOT publish_locked` i `product_effective_price > 0`
- `ORDER BY` samo `created_at DESC` ili efektivna cijena, plus `id`
- `LIMIT/OFFSET`
- `count(*)` ne smije ići preko cijelog skupa ako je skup ogroman. Vrati `total` kao `LEAST(count(*), 1000)` iz podupita koji ima `LIMIT 1001`, i boolean `truncated` ako je 1001. UI smije pisati „1000+“ kad je `truncated`. To zahtijeva izmjenu tipa odgovora u `resolve-search-results.ts` i teksta na stranici. Ne prikazuj lažan tačan broj.

`fetchAllSearchProductRows` se briše. `runSearchListing` zove RPC jednom i ne filtrira ponovo u memoriji, osim mapiranja u `Product`.

`unstable_cache` oko pretrage ostaje, ključ i dalje uključuje token, stranicu, sort i kategoriju, TTL 60 s, tag `search-results`. Ne keširaj prazan token.

`export const dynamic = "force-dynamic"` na `pretraga/page.tsx` ostaje. Stranica zavisi od `searchParams`. Data cache unutar RPC poziva je dovoljan. Ne pokušavaj je učiniti statičnom.

## 6.4 App

`buildCategoryFiltersPayload` mora prihvatiti isti JSON kao prije. Ako dodaš `count`, UI ga smije ignorisati. Ne mijenjaj izgled checkboxa u ovoj fazi.

Poslije izmjene funkcije: `NOTIFY pgrst, 'reload schema'`.

## Uspjeh

- Drugi `EXPLAIN` `get_category_shop_facets` za `kucista` ispod 30 ms i u planu se vidi Index Scan / heap fetch jednog reda `category_shop_facet_cache`, ne nested loop nad `product_attributes`.
- Pretraga `logitech` ne šalje više od jednog `products` range upita od 1000. U logu PostgREST-a ili u kodu više nema petlje `ROW_PAGE_SIZE`.
- `npm run test:pricing` i build prolaze.

## Rollback

Migracija koja dropa tabelu i vraća staro tijelo `get_category_shop_facets` (sačuvaj ga u komentaru migracije prije izmjene, `pg_get_functiondef`). Vrati `search-listing.ts`.

## Rizik

Prvi posjet poslije brisanja keša i dalje plaća skupu agregaciju. Zato prefetch kategorija i dalje nije dozvoljen prije nego što se na produkciji vidi drugi posjet ispod 30 ms. Kratki tokeni su odbijeni; provjeri da search input i dalje traži Enter i da jednoslovni upit pokaže prazan rezultat, ne grešku 500.

Kombinacije filtera se ne keširaju kao posebne facete. Facete su po kategoriji, ne po kombinaciji. Listing po kombinaciji ostaje na postojećem `unstable_cache` od 60 s. Ne pravi tabelu po svakoj kombinaciji filtera.
