# Faza 02 — manje posla po zahtjevu, bez novog cache modela

Ne uvodi `"use cache"`, `cacheComponents`, `generateStaticParams` niti duži TTL. TTL ostaje 60 s za listing i proizvod, 300 s za facete, 30 s za stablo kategorija.

## 2.1 Dvostruki render kategorije

`src/app/(shop)/kategorije/[...slug]/page.tsx`

`generateMetadata` zove `getCategoryProductsForPath`, što je puni listing RPC, samo da dobije ime kategorije. Page zatim zove `getCategoryPageData`, drugi cache ključ, pa se listing na hladnom ulasku radi dva puta.

Izmjena:

- Izvezi iz `src/lib/shop-category-listing.ts` funkciju `getCategoryMeta(categoryPath: string)` koja koristi postojeći `resolveCategoryCached` i vraća `{ id, name, slug }` ili `null`. Ne zovi RPC.
- `generateMetadata` koristi samo nju za title, description i canonical. OG slika: postojeći `getCategoryImageUrlForPath`, ali tek nakon što meta postoji. Ako meta vrati null, metadata je „Kategorija nije pronađena“ i nema redirecta u metadata. Redirect pointera ostaje u page komponenti, jer `redirect()` u metadata i u page danas može dva puta okinuti isti rad. Ukloni `pointerRedirectHrefForPath` iz `generateMetadata`.
- U page komponenti, `pointerRedirectHrefForPath` i `getCategoryPageData` ostaju. `api.getCategories()` i `getCategoryPageData` smiju u `Promise.all` tek nakon pointer redirecta, jer redirect mora stati prije listinga.

Ne mijenjaj SEO canonical, `seoFilterSegmentsToParams` niti JSON-LD. Canonical i dalje uključuje `?page=`.

## 2.2 Cache ključ ne smije sadržati marketing parametre

`buildCategoryListingCacheKey` u `src/lib/shop-category-listing.ts` danas serijalizuje sve query parametre. `utm_*`, `fbclid` i `view` prave novi ključ i novi SSR.

Whitelist, ovim redom u ključu:

- `page` samo ako je > 1
- `sort` samo ako nije `relevance`
- `brands`
- `prices`
- ostali ključevi koji postoje u mapi atributa te kategorije (slugovi iz `loadCategoryAttributeSlugMap`)

`view` se izbacuje iz URL-a. U `category-products-section.tsx` `handleViewChange` ne zove `router.push`. Drži `view` u `useState`, početna vrijednost `"grid"`. Ne čitaj `view` iz `searchParams`. Isto za list/grid na pretrazi u `product-search.tsx`.

## 2.3 Jedan RSC prolaz po kliku

Obriši drugi zahtjev:

- `category-products-section.tsx`: u `navigateSearch` nema `router.refresh()`.
- `product-search.tsx`: isto.
- `src/hooks/usePendingFilterNavigation.ts`: `pushUrlAndRefresh` radi samo `router.push`. Obriši `setTimeout(() => router.refresh(), 0)`.

`router.push` već traži novi RSC payload. `refresh()` traži još jedan.

## 2.4 Paginacija kao link

`src/components/shop/product-pagination.tsx` danas zove `router.push`, pa nema prefetcha.

Zamijeni MUI `Pagination` `onChange` tako da svaka stranica bude `next/link` sa `scroll={false}` i hrefom koji čuva postojeće filter parametre, mijenja samo `page`, i briše `page` na stranici 1. Ne dodaj `prefetch={true}` na sve brojeve. Prefetchaj samo `page+1` (`prefetch={true}` ako Next 16.1 to još tretira kao puni prefetch dinamičke rute) i ostale `prefetch={false}`.

Ako MUI Pagination ne prima link po stavci bez kopiranja cijelog komponenta, ostavi MUI za prikaz, ali `onChange` i dalje neka bude jedan `router.push` bez `refresh`. Ne uvodi ručni `router.prefetch` u petlji. Zapiši u PR koji si put uzeo.

## 2.5 Layout kategorija u data cache

`getLayoutData` u `src/lib/layout-data.ts` radi dva upita na svaki zahtjev. `utils/__api__/layout.ts` ima samo React `cache()`, koji živi jedan request.

Obmotaj tijelo `getLayoutData` sa `unstable_cache`, ključ `["shop-layout-categories"]`, `revalidate: 300`, tag `shop-layout`. Funkcija unutra ne smije zvati `cookies()` niti `headers()`. Već koristi service client; to zadrži.

U `revalidateCategorySurfaces` (`src/lib/revalidate-categories.ts`) dodaj `revalidateTag("shop-layout", "max")`. Ne zovi `revalidatePath` za svaki API ako već postoji; samo dodaj ovaj tag.

## 2.6 Početna: jedan upit blokova i uži select

`loadActiveHomepage` se zove iz section-1 i section-5. Obmotaj je sa React `cache()` u `src/lib/homepage/load-homepage.ts` (import `cache` from `"react"`). To je dedup u jednom requestu, ne TTL.

U `load-flash-deals.ts`, `load-top-rated.ts` i `load-products.ts` ukloni `description` iz `select` stringa koji puni kartice. Kartica koristi ime, sliku, cijenu, slug, brand i kategoriju. Ako tip `DbProduct` traži description, stavi `description: null` u mapperu. Ne mijenjaj uslov `is_flash_deal` / `is_featured` i ne preskači upit kad je broj nula. Prazan rezultat i dalje puni ostatak do 6 najnovijih, to je postojeće ponašanje.

Indeks koji taj upit ubrzava je faza 03. Ova faza samo smanjuje širinu reda.

## 2.7 Slike, samo props

Ne mijenjaj `remotePatterns` niti prebaci slike na drugi CDN.

| Fajl | Izmjena |
| --- | --- |
| `product-gallery.tsx` | `sizes` glavne slike: `(max-width: 768px) 100vw, 480px`. Thumbnail: `48px`. Obriši `"(400px 400px)"` i `"(48px 48px)"`. |
| mini-cart `cart-item.tsx` | `sizes="96px"` umjesto `"(100px, 100px)"`. |
| `product-card-1` | ukloni `priority` sa svih related kartica. Prva slika galerije na PDP smije zadržati priority ako ga već ima; related ne. |
| `next.config.ts` | `images.minimumCacheTTL` sa 60 na 86400. |

`priority` na logotipu u headeru ostaje.

## 2.8 Loading

`src/app/loading.tsx` danas mijenja cijeli sadržaj ispod root layouta u spinner, uključujući shop chrome.

- Obriši tijelo `src/app/loading.tsx` tako da fajl više ne postoji, ili neka vraća `null`. Preferiraj brisanje fajla.
- Dodaj `src/app/(shop)/loading.tsx` koji vraća sivi pravougaonik visine 240 px unutar postojećeg container ritma, bez `CircularProgress` preko cijelog ekrana. Ne uvozi CartContext.
- Ne dodaj loading.tsx u root ponovo.

Homepage Suspense `fallback={null}` ostaje u ovoj fazi. Skeleti po sekciji su faza 07.

## Uspjeh

- Hladan HTML kategorije više ne pokreće dva ista listing RPC-a. Provjera: privremeno `console.time` je zabranjen u produkciji. Umjesto toga u dev logu jedan ručni poziv, ili uporedi `pg_stat_statements` `calls` za `get_category_products_listing` tokom 10 otvaranja iste kategorije prije i poslije. Očekivanje je otprilike prepolovljen broj poziva po otvaranju.
- Promjena grid/list ne šalje novi dokument (u Network tabu nema RSC zahtjeva).
- Sort i filter šalju jedan RSC, ne dva.
- `npm run build` prolazi.

## Rollback

Vrati navedene fajlove. Tag `shop-layout` koji niko ne invalidira poslije rollbacka ističe za 300 s. To je prihvatljivo.

## Ne raditi u ovoj fazi

- Ne diraj `export const revalidate`.
- Ne pretvaraj `CategoryProductsSection` u server komponentu (faza 07).
- Ne dodaj hover prefetch nad karticama.
