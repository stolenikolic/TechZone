# Kako implementirati ovaj paket

Ovo je ulaz za model koji radi izmjene. Glavni izvještaj je [`../PERFORMANCE_AUDIT_AND_OPTIMIZATION_PLAN.md`](../PERFORMANCE_AUDIT_AND_OPTIMIZATION_PLAN.md). Ovaj direktorij sadrži zadatke koje se smije raditi jedan po jedan.

## Pravila

1. Radi tačno jednu fazu, pa zaustavi se i izmjeri je protokolom iz [`MEASUREMENT_PROTOCOL.md`](MEASUREMENT_PROTOCOL.md). Ne otvaraj sljedeću fazu u istom diffu.
2. Ne mijenjaj ponašanje koje faza izričito ne spominje. Posebno ne diraj admin, uvoz dobavljača, pricing engine formule (`computeFinalSellingKm`, marže, PDV) niti RLS.
3. Ne uključuj `cacheComponents` prije faze 08. Faza 08 se ne radi dok korisnik posebno ne odobri mjerenja faza 01–06.
4. Ne dodaj TanStack Query, SWR, Redis niti eksterni search.
5. Ne generiši svih 51.000 proizvoda u `generateStaticParams`.
6. SQL ide u novu migraciju kreiranu naredbom `supabase migration new <ime>`, nikad ručnim imenom fajla i nikad direktnim `apply_migration` na produkciju bez revizije SQL-a iz odgovarajuće faze. Ne pokreći `EXPLAIN ANALYZE` u migraciji.
7. `tsconfig.json` target ostaje `es5`. Zato je zabranjen spread `Set`/`Map` (`[...set]`). Koristi `Array.from`.
8. Poslije svake faze: `npx tsc --noEmit` i `npm run build`. Build danas pada i prije tvojih izmjena; faza 00 to mora popraviti prije ostalih faza.
9. Ako build prijavi grešku koju faza nije predvidjela, vrati svoje izmjene te faze i zaustavi se. Ne „popravljaj usput“ druge sisteme.
10. Cijena koju plaća kupac dolazi samo iz serverske funkcije definirane u fazi 01. Klijentski `unitPrice` se ignoriše.

## Redoslijed

| Faza | Fajl | Smije li se raditi odvojeno | Zavisi od |
| --- | --- | --- | --- |
| 00 | [phase-00-build.md](phase-00-build.md) | da, i mora prva | ništa |
| 01 | [phase-01-order-price.md](phase-01-order-price.md) | da | 00 |
| 02 | [phase-02-request-path.md](phase-02-request-path.md) | da | 00 |
| 03 | [phase-03-database.md](phase-03-database.md) | da | 00 |
| 04 | [phase-04-invalidation.md](phase-04-invalidation.md) | da | 02 i 03, jer tagovi moraju pokrivati nove cache ključeve |
| 05 | [phase-05-rendering.md](phase-05-rendering.md) | da | 02, 03, 04 |
| 06 | [phase-06-search-facets.md](phase-06-search-facets.md) | da, i prije agresivnog prefetcha | 03 i 04 |
| 07 | [phase-07-client.md](phase-07-client.md) | da | 05 |
| 08 | [phase-08-cache-components.md](phase-08-cache-components.md) | ne, dok korisnik ne odobri | 01–07 izmjerene |

Faze 02 i 03 smiju ići paralelno samo ako ih rade različite grane. U jednoj grani drži se redoslijeda.

## Šta je namjerno odbačeno

- Uključivanje `cacheComponents` kao „quick win“. U Next.js 16.1.1 taj flag mijenja podrazumijevano ponašanje cijelog App Routera: svaki `cookies()`, `headers()`, `searchParams` i neke nekeširane podatke van `<Suspense>` ruši `next build`. To danas pogađa shop, admin, checkout i nalog.
- Prefetch svih proizvoda u viewportu prije nego listing i facete prestanu raditi skupe upite. To množi skupe zahtjeve.
- Prelazak na skuplji Supabase compute ili Netlify region kao prvi korak. Prvo se uklanjaju upiti koji traju sekunde. Co-location je ops odluka u izvještaju, ne kod u ovim fazama.
- Kopiranje iPon-a. Sajt nije izmjeren (ban). Ne izmišljaj njihove headere niti arhitekturu.
