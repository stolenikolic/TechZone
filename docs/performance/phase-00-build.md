# Faza 00 — build mora proći

## Trenutno stanje

`npm run build` (Next.js 16.1.1, Turbopack) kompajlira se, zatim padne na TypeScriptu:

`src/lib/suppliers/alza/importProducts.ts:183`

`Type 'Set<number>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.`

Uzrok je `tsconfig.json` `"target": "es5"`. `scripts/` je izvan `include`, ali `src/lib/suppliers` ulazi u build. Spread `[...ids]` nad `Set` se spušta na downlevel iteraciju koju es5 target ne dozvoljava.

Build također ispisuje upozorenje da je `src/middleware.ts` zastarjela konvencija i da Next.js 16 želi `proxy`. To se u ovoj fazi ne mijenja. Premještanje middlewarea je faza 08.

## Izmjena

U `categoryIdsFromRaw` zamijeni samo return liniju.

Prije:

```ts
return [...ids].sort((a, b) => a - b);
```

Poslije:

```ts
return Array.from(ids).sort((a, b) => a - b);
```

Ne mijenjaj `tsconfig.json` target. Podizanje targeta mijenja emit cijelog projekta i nije potrebno.

## Provjera

1. `npx tsc --noEmit`
2. `npm run build`
3. U ispisu builda zapiši tabelu ruta u `docs/performance/build-route-table.txt` (ne commitaj `.next`). Posebno označi `/`, `/kategorije`, `/kategorije/[...slug]`, `/proizvodi/[slug]`, `/pretraga` kao static, ISR ili dynamic, onim simbolom koji build ispiše.

Ako build i dalje padne na drugom `Set` spreadu, popravi samo taj isti obrazac (`Array.from`) i nemoj dirati ništa drugo. Ako padne na nečemu drugom, stani.

## Uspjeh

`npm run build` izađe sa kodom 0. Tabela ruta postoji u `build-route-table.txt`.

## Rollback

Vrati jednu liniju. Nema podataka ni migracije.

## Rizik

Nikakav za shop. Funkcija samo sortira Alza category id-eve prije Pythona.
