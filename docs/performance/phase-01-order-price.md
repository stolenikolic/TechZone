# Faza 01 — serverska cijena i dostupnost narudžbe

## Problem

`createOrder` u `src/lib/orders/orders-service.ts` (oko linija 356–359) snima `item.unitPrice` koji je poslao browser (`src/pages-sections/payment/payment-form.tsx` šalje `unitPrice: item.price`). Ako je broj konačan i veći od 0, baza se ne pita. Kupac može naručiti po 0,01 KM.

Korpa već zna izračunati cijenu: `resolveCartOfferPrices` u `src/lib/cart/offer-pricing.ts`. Taj put ignoriše `custom_price`. Listing i stranica proizvoda koriste `getEffectivePrice` (`src/lib/effective-price.ts`): ako `custom_price` postoji, on je prodajna cijena, inače `products.price`. `products.price` je engine cijena; agregator je ne prepisuje custom vrijednošću (`aggregate-prices.ts` snima `enginePrice` u `price`, a custom koristi samo za precrtanu cijenu).

Zato korpa i katalog danas mogu pokazati različit iznos. Narudžba mora slijediti jedno pravilo, i korpa mora pokazati isti iznos prije klika na plati.

## Pravilo

Za svaku stavku, ovim redom:

1. Proizvod mora proći `applyStorefrontProductVisibility` (`is_active = true` i `publish_locked = false`). Inače cijela narudžba staje, bez inserta.
2. `supplierProductId` je obavezan. Nema ga → greška, bez inserta.
3. Offer mora postojati, `supplier_products.product_id` mora biti taj proizvod, `is_active = true`, `price_amount` mora dati pozitivnu nabavnu cijenu. Inače greška. Ovo je isti neuspjeh koji `computeSellingFromRow` već vraća kao `null`.
4. Ako je `custom_price` konačan broj veći od 0, jedinična cijena je `custom_price`.
5. Inače je jedinična cijena `sellingPrice` iz `resolveCartOfferPrices` / `computeSellingFromRow`.
6. Vrijednost iz JSON-a se ne čita za iznos. `qty` ostaje iz klijenta, ali samo cijeli broj od 1 do 99.

Nema posebne kolone za stanje na lageru. Dostupnost je aktivni offer plus vidljiv proizvod. `delivery_days` ostaje rok, ne količina.

## Implementacija

### 1. Nova funkcija

Dodaj `src/lib/orders/authoritative-price.ts`.

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveCartOfferPrices } from "lib/cart/offer-pricing";
import { getEffectivePrice } from "lib/effective-price";
import { applyStorefrontProductVisibility } from "lib/storefront-product-visibility";

export type PricedOrderLine = {
  productId: string;
  supplierProductId: string;
  qty: number;
  unitPrice: number;
};

export async function priceOrderLines(
  supabase: SupabaseClient,
  lines: { productId: string; supplierProductId: string | null; qty: number }[]
): Promise<PricedOrderLine[]> {
  if (lines.some((line) => !line.supplierProductId)) {
    throw new Error("Svaka stavka mora imati ponudu dobavljača.");
  }
  if (lines.some((line) => !Number.isInteger(line.qty) || line.qty < 1 || line.qty > 99)) {
    throw new Error("Količina stavke nije ispravna.");
  }

  const productIds = Array.from(new Set(lines.map((line) => line.productId)));
  const { data, error } = await applyStorefrontProductVisibility(
    supabase.from("products").select("id, custom_price, price").in("id", productIds)
  );
  if (error) throw new Error(error.message);
  const products = new Map((data ?? []).map((row) => [row.id as string, row]));
  if (products.size !== productIds.length) {
    throw new Error("Neki proizvodi više nisu dostupni.");
  }

  const offerLines = lines.map((line) => ({
    lineId: `${line.productId}:${line.supplierProductId}`,
    productId: line.productId,
    supplierProductId: line.supplierProductId as string
  }));
  const priced = await resolveCartOfferPrices(supabase, offerLines);
  if (priced.unavailableIds.length > 0) {
    throw new Error("Neke ponude više nisu dostupne.");
  }
  const byLine = new Map(priced.prices.map((row) => [row.id, row.price]));

  return lines.map((line) => {
    const product = products.get(line.productId)!;
    const offerPrice = byLine.get(`${line.productId}:${line.supplierProductId}`);
    if (offerPrice == null || offerPrice <= 0) {
      throw new Error("Ponuda nema važeću cijenu.");
    }
    const override = product.custom_price == null ? null : Number(product.custom_price);
    const unitPrice = override != null && Number.isFinite(override) && override > 0
      ? getEffectivePrice(override, offerPrice)
      : offerPrice;
    return {
      productId: line.productId,
      supplierProductId: line.supplierProductId as string,
      qty: line.qty,
      unitPrice: Math.round(unitPrice * 100) / 100
    };
  });
}
```

`getEffectivePrice(override, offerPrice)` vraća override kad postoji. Poziv je namjeran, da se ne uvodi drugi način zaokruživanja.

### 2. `createOrder`

U `src/lib/orders/orders-service.ts` ukloni granu koja bira `item.unitPrice`. Poslije `validatePayload`:

- pozovi `priceOrderLines` sa `productId`, `supplierProductId`, `qty`
- `unit_price` i `line_total` uzmi isključivo iz rezultata
- snapshot naziva, sluga i slike i dalje smije doći iz proizvoda u bazi (`select` proširi na `name, slug, main_image`), ne iz klijentskog title/slug ako se razlikuje od baze. Klijentski tekst nije cijena, ali za naziv na stavci koristi `products.name`.

Ako `priceOrderLines` baci, `createOrder` baca dalje i ne insertuje `orders`. Današnji kod insertuje tek poslije mape; to zadrži. Nemoj praviti order pa ga brisati.

### 3. Korpa mora pokazati istu cijenu

U `resolveCartOfferPrices`, nakon što izračunaš `sellingPrice` za liniju, učitaj `custom_price` tog proizvoda (već imaš product red u okolnim upitima; ako ga nema u toj funkciji, dodaj `custom_price` u postojeći `select`, ne novi upit po liniji).

Ako je custom konačan i veći od 0, `prices[].price` postaje custom, a `originalPrice` ostaje engine original samo ako je veći od customa (isto pravilo kao `getOriginalPriceForDisplay`).

Time `/api/cart/prices` i narudžba dijele iznos. `hydrateCartItemsFromOffers` već prikazuje `priceRow.price`, pa ne treba drugi izuzetak.

Ne mijenjaj `computeFinalSellingKm` niti agregator. Custom i dalje ne prepisuje `products.price`.

### 4. Klijent

U `payment-form.tsx` `unitPrice` smije ostati u JSON-u radi starog koda, ali server ga ne smije čitati. Bolje ga ukloni iz body-ja da sljedeći model ne „vrati“ staru granu. Narudžba i dalje šalje `productId`, `supplierProductId`, `qty` i checkout polja.

## Test

Dodaj `src/lib/orders/authoritative-price.test.ts` samo ako u repou već postoji runner za tsx testove koji ne traži novu biblioteku. Ako ne postoji, nemoj dodavati Jest. Umjesto toga napiši `scripts/test-authoritative-price.ts` po uzoru na `scripts/test-pricing-engine.ts` i ne dodaj ga u nightly.

Test ne smije pisati u produkcijsku bazu. Ako ne možeš mockovati klijent bez nove biblioteke, izdvoji čisto pravilo:

```ts
export function chooseUnitPrice(customPrice: number | null, offerPrice: number): number {
  if (customPrice != null && Number.isFinite(customPrice) && customPrice > 0) return customPrice;
  if (!Number.isFinite(offerPrice) || offerPrice <= 0) {
    throw new Error("Ponuda nema važeću cijenu.");
  }
  return offerPrice;
}
```

i testiraj tu funkciju: custom 10 i offer 20 → 10; custom null i offer 20 → 20; custom 0 i offer 20 → 20; offer 0 → greška. `priceOrderLines` i dalje radi provjere dostupnosti okolo.

## Uspjeh

Pet slučajeva iz `MEASUREMENT_PROTOCOL.md` odjeljak 3. Postojeća `npm run test:pricing` i dalje prolazi.

## Rollback

Vrati `orders-service.ts`, `payment-form.tsx` i `offer-pricing.ts` i obriši novi fajl. Nema migracije. Stare narudžbe se ne diraju.

## Rizik

Ako je `custom_price` postavljen, iznos u korpi se mijenja u odnosu na današnji offer iznos. To je namjerno usklađivanje sa katalogom. Prije mergea pokreni read-only:

```sql
SELECT count(*) FROM products WHERE custom_price IS NOT NULL AND custom_price > 0;
```

Ako je broj velik, u PR opisu navedi broj. Ne mijenjaj te redove.

Gost bez offer id-a više ne može naručiti. Dugme za korpu već traži offer (`add-to-cart.tsx` je disabled bez offera). Ako nađeš poziv `createOrder` bez `supplierProductId`, to je bug tog poziva, ne razlog da se vrati klijentska cijena.
