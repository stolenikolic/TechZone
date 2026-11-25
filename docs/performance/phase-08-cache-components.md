# Faza 08 — Cache Components, samo uz posebno odobrenje

Ne počinji ovu fazu zajedno sa bilo kojom drugom. Ne počinji je dok faze 01–06 nisu na produkciji i dok `MEASUREMENT_PROTOCOL.md` nije popunjen poslije njih.

## Zašto uopšte postoji

Prefetch dinamične rute u 16.1.1 ne nosi podatke. `cacheComponents: true` i `partialPrefetching: true` u `next.config.ts` mijenjaju model: ono što je u `"use cache"` može ući u prefetch shell. To je jedini put u ovoj verziji da hover na link povuče serverski render prije klika, a da se ne piše ručni fetcher.

Next.js dokumentacija (2026): `cacheComponents` uključuje i PPR. `use cache` bez `cacheLife` dobija podrazumijevani profil. `cookies()` i `searchParams` van `<Suspense>` ruše build. OpenNext Netlify adapter od 5.11 podržava `use cache`, a od 5.15.1/5.15.4 ima popravke za PPR shell na 16.1. To je podrška adaptera, ne garancija da ovaj repo prođe build.

## Šta će puknuti ako se flag upali na trenutnom kodu

Provjereno u kodu, mora biti riješeno prije flaga, ne poslije nasumičnih build grešaka:

| Mjesto | Zašto |
| --- | --- |
| `src/app/(shop)/page.tsx`, `(shop)/layout.tsx`, `proizvodi/[slug]/page.tsx` | `export const revalidate = 60` nije spojiv sa novim modelom; zamjena je `cacheLife` unutar `"use cache"` |
| `pretraga/page.tsx` i admin/checkout/customer/potvrda layouti | `export const dynamic = "force-dynamic"` se uklanja ili ruta ostaje van keša kroz Suspense |
| `kategorije/[...slug]/page.tsx`, `pretraga/page.tsx` | čitaju `searchParams` u page-u |
| `utils/supabase/server.ts` | `cookies()`; ne smije ući u shop render |
| `shop-layout-1.tsx` | `new Date().getFullYear()` |
| `compute-product-offers.ts` | `new Date()` unutar puta koji puni keširani proizvod |
| `product-pagination.tsx`, `product-filters.tsx`, `category-products-section.tsx`, `product-search.tsx` | `useSearchParams` bez Suspense granice oko cijelog listing stabla |
| `src/middleware.ts` | upozorenje da konvencija postaje `proxy.ts`; preimenuj samo ako službena migracija za 16.1 to traži u trenutku rada, i zadrži matcher i javni short-circuit bez Supabase poziva |

`unstable_cache` pozivi ostaju dok se jedan po jedan ne preseli. Ne prepisuj sve u jednom PR-u.

## Red unutar faze, svaki korak poseban PR

1. Ukloni dinamičke API-je iz shop RSC puta (datum, cookies). Build još bez flaga.
2. Omotaj listing klijent (`useSearchParams`) u `<Suspense>` na page-u, sa skeleton fallbackom iz faze 02.
3. Uključi flag. Popravi samo greške koje build izričito navede. Ako ih je više od onoga što možeš zatvoriti bez diranja admina, ugasi flag i stani.
4. Preseli `getCategoryPageData`, `getProduct` i `getLayoutData` sa `unstable_cache` na `"use cache"` + `cacheLife` + `cacheTag`, isti tagovi kao danas (`category-listing-*`, `shop-layout`, `search-results`). Invalidacija iz faze 04 mora i dalje zvati `revalidateTag(tag, "max")`.
5. Tek tada izmjeruj veličinu prefetch RSC-a. Uspjeh je prefetch kategorije znatno iznad 9 KB i klik koji ne čeka puni TTFB funkcije. Ako je prefetch i dalje 9 KB, flag nije donio cilj; isključi ga.

## Zabranjeno i u ovoj fazi

- prefetch svih linkova u meniju ručnim fetchom
- statički build svih proizvoda
- dijeljenje korpe, sesije ili wishlist-a kroz `"use cache"` bez `"use cache: private"`
- mijenjanje formule cijene

## Rollback

`cacheComponents: false` i `partialPrefetching` uklonjen. `"use cache"` direktive uklonjene, `unstable_cache` vraćen. Zato korak 4 ne briše stare helpere dok prefetch mjerenje ne prođe; drži ih u istom fajlu iza jedne grane dok PR nije gotov, pa obriši mrtvi put u istom PR-u samo ako je mjerenje uspjelo.

Ako je mjerenje neuspješno, merge se ne radi.
