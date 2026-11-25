# Protokol mjerenja prije i poslije svake faze

Sva vremena su sa produkcijskog URL-a nakon deploya te faze. Lokalni `next dev` se ne koristi za zaključak o brzini. `techzone.ba` ne postoji dok se domen ne kupi; danas je `https://techzoneba.netlify.app`.

Deploy koji je mjeren 2026-11-24 je stariji od HEAD-a: rute su `/categories` i `/products`, ne `/kategorije` i `/proizvodi`. Poslije deploya HEAD-a koristi bosanske rute iz ovog repoa.

## 1. Serversko vrijeme, bez TCP/TLS

Ponovi 7 puta. Serversko vrijeme je `time_starttransfer - time_appconnect`. Zapiši min, medijanu i max. Odbaci prvi poziv ako je višestruko veći (hladan start) i zapiši ga posebno.

```powershell
curl.exe -s -o NUL --max-time 40 -w "code=%{http_code} tls=%{time_appconnect} ttfb=%{time_starttransfer}`n" "URL"
```

Obavezni URL-ovi:

| Oznaka | URL | Šta dokazuje |
| --- | --- | --- |
| cdn | `/assets/images/logo.svg` | samo edge |
| fn0 | `/api/homepage/service` | funkcija bez baze |
| fn2 | `/api/layout` | funkcija i 2 sekvencijalna upita |
| home | `/` | početna |
| cat | najveća listajuća kategorija | kategorija |
| pdp | jedan `/proizvodi/<slug>` ili stari `/products/<slug>` | proizvod |
| search | `/pretraga?q=logitech` ili stari `/products/search?q=logitech` | pretraga |

Za HTML i RSC zapiši i `Cache-Status`, `Age`, `X-Nextjs-Prerender`, `X-Nextjs-Stale-Time`:

```powershell
curl.exe -s -D - -o NUL --max-time 40 "URL"
```

RSC navigacija i prefetch, odvojeno:

```powershell
curl.exe -s -o NUL -D - -H "RSC: 1" -w "ttfb=%{time_starttransfer} size=%{size_download}`n" "URL?_rsc=nav"
curl.exe -s -o NUL -D - -H "RSC: 1" -H "Next-Router-Prefetch: 1" -w "ttfb=%{time_starttransfer} size=%{size_download}`n" "URL?_rsc=pf"
```

Prefetch koji ostane oko 9 KB i dalje nosi samo loading shell, ne stranicu. To nije uspjeh prefetch faze.

## 2. Baza, samo read-only

Projekat `bxicebgwhwgtofdxnkks`. Ne pokreći `VACUUM FULL`, `CREATE INDEX` bez `CONCURRENTLY` iz sesije koja drži transakciju, niti `EXPLAIN ANALYZE` nad `UPDATE`.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM public.products
WHERE is_active AND NOT publish_locked AND is_flash_deal
ORDER BY created_at DESC
LIMIT 6;
```

Isto za `is_featured`. Poslije faze 03 očekivanje je Index Scan i vrijeme ispod 50 ms na toplom kešu, 0 redova dok nema označenih proizvoda.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT public.get_category_shop_facets('c82fb741-d161-4c73-91fc-1cc6fad2123d'::uuid);
```

Kategorija `kucista`. Poslije faze 06, topli poziv mora biti čitanje keš tabele, ispod 30 ms.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, total_count
FROM public.get_category_products_listing(
  'c82fb741-d161-4c73-91fc-1cc6fad2123d'::uuid,
  NULL, NULL, NULL, '[]'::jsonb, 'asc', 1, 30
);
```

Poslije uklanjanja `description` iz listing RPC-a, plan ne smije imati `temp written` na toplom kešu za ovu kategoriju.

## 3. Tačnost narudžbe, faza 01

Ne šalji pravu narudžbu na produkciju ako time nastaje prava porudžbina. Koristi preview deploy ili lokalni `next start` spojen na bazu samo ako korisnik to izričito dozvoli. Inače pokrij jediničnim testom koji mockuje Supabase.

Slučajevi:

1. Klijent pošalje `unitPrice: 0.01` za aktivan offer. Sačuvana `order_items.unit_price` mora biti serverska cijena, ne 0.01.
2. Offer sa `is_active = false` mora odbiti cijelu narudžbu i ne smije napraviti `orders` red.
3. Proizvod sa `publish_locked = true` ili `is_active = false` mora odbiti narudžbu.
4. `custom_price` postavljen: i korpa (`/api/cart/prices`) i narudžba vraćaju taj iznos, ne engine cijenu.
5. Bez `supplierProductId` narudžba se odbija.

## 4. Šta se ne zaključuje

- Jedan TTFB iz `next dev`.
- Jedan `EXPLAIN` sa hladnim `shared read` kao „baza je spora“. Ponovi isti `EXPLAIN` odmah; drugi prolaz je topli keš. Oba zapiši. Primjer iz audita: isti scan kategorije 1,6 s hladno i 15 ms toplo.
- Brzinu iPon-a. Nije izmjerena.

## 5. Ciljevi poslije faza 01–06, isti region funkcija

Ovo su ciljevi dok funkcije ostanu u Ohiju, baza u Frankfurtu. Nisu obećanje prije mjerenja.

| Putanja | Medijana serverskog vremena 2026-11-24 | Cilj |
| --- | --- | --- |
| funkcija bez baze | 0,21 s | ne dirati |
| `/api/layout` | 0,92 s | ispod 0,45 s uz data cache |
| kategorija, topli data cache | 0,6–1,1 s HTML | ispod 0,5 s |
| listing RPC `kucista`, toplo | 42 ms | ostaje ispod 80 ms i bez temp fajla |
| facete `kucista` | 1193 ms | ispod 30 ms iz keš tabele |
| flash/featured upit | 3,2–3,9 s | ispod 50 ms |
| narudžba sa tuđom cijenom | prolazi | odbija se ili snima serversku cijenu |
