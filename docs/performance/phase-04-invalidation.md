# Faza 04 — invalidacija keša poslije synca, bez vezivanja za Netlify

## Problem

`revalidatePath` / `revalidateTag` zovu samo admin rute (`src/lib/revalidate-categories.ts`, `src/lib/homepage/revalidate.ts`, `src/app/api/admin/products/by-slug/[slug]/route.ts`). `price-sync.yml` (svaka 4 h) i `nightly-pipeline.yml` ne zovu sajt. `aggregatePricesForProductIds` vraća samo `{ updated, batches, warnings, error }`, ne listu id-eva.

Na deployu izmjerenom 2026-11-24 početna je imala `Age: 340260` (oko 3,9 dana) uz `X-Nextjs-Prerender: 1` i `X-Nextjs-Stale-Time: 300`. `revalidate = 60` u kodu nije značilo da Netlify Durable drži svjež HTML 60 s. Zato se TTL u ovom paketu ne produžava. Invalidacija mora postojati prije bilo kakvog dužeg keša.

Keš cijene u katalogu smije kasniti. Narudžba ne smije: faza 01 računa cijenu u trenutku inserta.

## API

Novi `src/app/api/revalidate/route.ts`. Samo `POST`.

Body:

```ts
type Body = {
  secret?: string;
  tags?: string[];
  paths?: string[];
};
```

Pravila:

1. `REVALIDATE_SECRET` iz env, najmanje 32 nasumična bajta, nije `NEXT_PUBLIC_`.
2. Poređenje `crypto.timingSafeEqual` nad bufferima iste dužine. Ako dužina ne odgovara, 401, bez detalja.
3. Najviše 50 tagova i 50 pathova. Višak se odbija sa 400. Prazan niz je 400.
4. Tag smije biti samo: `shop-layout`, `homepage-categories`, `search-results`, ili string koji počinje sa `category-listing-`. Path smije biti samo `/`, `/kategorije`, `/pretraga`, ili putanja koja matcha `^/(kategorije|proizvodi)/[a-z0-9/-]+$`.
5. Za tag `revalidateTag(tag, "max")`, isto kao postojeći helper. Za path `revalidatePath(path)`.
6. Odgovor `{ ok: true, tags: number, paths: number }`. Ne vraćaj secret niti listu proizvoda.
7. `export const dynamic = "force-dynamic"`. Nema keša ovog route handlera.

Ne koristi Netlify-specific cache handler. Isti endpoint radi na svakom hostu koji pokreće Next.js.

## Ko zove

U `src/lib/pricing/revalidate-storefront.ts` (običan `fetch`, bez Next importa, da radi u GitHub Actions preko `tsx`):

```ts
export async function notifyStorefrontRevalidate(input: {
  tags: string[];
  paths: string[];
}): Promise<void> {
  const url = process.env.STOREFRONT_REVALIDATE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!url || !secret) return;
  const tags = input.tags.slice(0, 50);
  const paths = input.paths.slice(0, 50);
  if (tags.length === 0 && paths.length === 0) return;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret, tags, paths })
  });
}
```

Ako `fetch` padne, sync se ne obara. Uloguj upozorenje i završi job kao danas. Svježina tada ostaje na TTL-u.

Poziv stoji na kraju price synca, tamo gdje `changedProductIds` još postoji (iPon XML, Avtera, ComTrade), poslije `aggregatePricesForProductIds`. Jedan upit:

```ts
supabase.from("products").select("id, slug, category_id").in("id", ids.slice(0, 200))
```

Ako je promijenjenih id-eva više od 200, ne šalji pathove proizvoda. Pošalji samo tagove kategorija (deduplikovani `category-listing-${id}`) plus `search-results` i `shop-layout`. To je svjesno grublje: bolje invalidirati kategoriju nego praviti 10.000 path invalidacija.

Noćni puni `aggregatePrices()` nema listu id-eva. Na kraju tog joba pošalji fiksno:

```ts
{ tags: ["search-results", "shop-layout", "homepage-categories"], paths: ["/", "/kategorije"] }
```

Ne izmišljaj tag po svakoj kategoriji u noćnom jobu.

## GitHub

U `price-sync.yml` i `nightly-pipeline.yml` env:

```yaml
STOREFRONT_REVALIDATE_URL: ${{ secrets.STOREFRONT_REVALIDATE_URL }}
REVALIDATE_SECRET: ${{ secrets.REVALIDATE_SECRET }}
```

Secreti se dodaju ručno. URL je `https://<host>/api/revalidate`. Nemoj staviti URL u repo.

Admin rute i dalje zovu postojeće helpere. Ne preusmjeravaj admin kroz HTTP na samog sebe.

## Uspjeh

1. POST bez secreta → 401.
2. POST sa secretom i tagom `search-results` → 200.
3. POST sa pathom `https://evil.example` → 400.
4. Poslije jednog ručnog price-sync dry runa (ako postoji) ili poslije prvog pravog synca, sljedeći zahtjev kategorije čiji je proizvod u tom syncu nije serviran iz starog data cache unosa. Praktično: promijeni cijenu jednog test proizvoda u adminu i potvrdi da postojeći admin `revalidatePath` i dalje radi; zatim posebno pozovi endpoint i potvrdi 200.

## Rollback

Obriši route i pozive. Sync opet samo piše bazu. Stari keš ističe za najviše 300 s (facete) ili 60 s (listing), osim ako host drži prerender duže, što je upravo razlog da endpoint postoji. Brisanje endpointa vraća taj rizik, ne kvari podatke.

## Ne raditi

- Ne produžavaj `revalidate` brojeve.
- Ne invalidiraj po svakom od 64.000 proizvoda.
- Ne stavljaj secret u `NEXT_PUBLIC_` niti u log.
