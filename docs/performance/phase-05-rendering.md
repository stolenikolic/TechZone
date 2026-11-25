# Faza 05 — šta prefetch stvarno može, bez Cache Components

## Činjenica za ovu verziju

Next.js 16.1.1, bez `cacheComponents`. Dinamična ruta se na prefetch ne šalje cijela. Na produkciji 2026-11-24 prefetch kategorije i proizvoda (`Next-Router-Prefetch: 1`) vratio je 8,6–8,9 KB, a navigacioni RSC 95–99 KB. Tih 9 KB je loading shell, ne katalog.

Zato hover prefetch nad svakom karticom, prije ove faze, samo množi pozive funkcije u Ohiju i upite u Frankfurtu. Ne radi se.

`export const revalidate = 60` na `/proizvodi/[slug]` ne dokazuje ISR dok `npm run build` u `build-route-table.txt` ne pokaže simbol za tu rutu. Mjerenje `fwd=bypass` je sa starog deploya (engleske rute) i ne važi za HEAD.

## 5.1 Pročitaj tabelu ruta

Otvori `docs/performance/build-route-table.txt` iz faze 00, ponovo generisanu poslije faza 02–04.

- Ako je `/proizvodi/[slug]` već ISR ili static, ne diraj `new Date()`.
- Ako je `ƒ` dynamic, prvi osumnjičeni je `new Date()` u `src/lib/product-offers/compute-product-offers.ts` (oko linije 158) i `delivery-estimate.ts`, jer `getProduct` to zove tokom RSC-a. Isto footer `new Date().getFullYear()` u `shop-layout-1.tsx` (oko linije 152). Godina u footeru zamijeni se konstantom `2026` samo ako build i dalje označava cijeli `(shop)` layout kao dynamic zbog te linije. Ne uvodi `cookies()` u shop layout.

Izdvajanje datuma isporuke: izračun ostaje na serveru, ali ulaz `today` neka bude `new Date()` unutar funkcije koja je već na dinamičkoj ruti korpe, ne unutar `unstable_cache` callbacka `getProduct`. Ako je `new Date()` unutar `unstable_cache` callbacka, iznesi ga van i proslijedi `YYYY-MM-DD` string kao argument keša, zaokružen na dan. Time se keš proizvoda ne invalidira na svaku milisekundu, a datum isporuke i dalje postoji.

Ne radi ovo ako build već kaže da je ruta ISR. Pogrešan zahvat mijenja tekst isporuke bez dobiti.

## 5.2 Šta se prefetcha

Samo `next/link` koji već postoji na karticama proizvoda i u meniju kategorija. Ne dodaj `onMouseEnter` → `router.prefetch`. Ne dodaj prefetch sljedeće stranice osim onoga što faza 02 već ograničava na `page+1`.

Na mobilnom nema hovera. Viewport prefetch je podrazumijevani Next `Link` za statične rute. Za dinamične rute on i dalje nosi samo shell dok faza 08 ne postoji. To je prihvaćeno ograničenje, ne bug za rješavati ručnim fetchom.

`saveData` i spora veza: ne piši svoj detector. Ako dodaš ijedan ručni prefetch mimo Linka, prvo izađi iz faze; to nije ovaj zadatak.

## 5.3 Prefetch ne smije čekati fasete

Ne počinji ovu fazu prije faze 06 ako je cilj „klik na kategoriju izgleda trenutno“. Dok facete traju 1,2 s, dinamični RSC klik traje koliko i baza plus prekookeanski hop. Faza 05 ne maskira tu cijenu.

## Uspjeh

- Broj RSC zahtjeva pri prelasku mišem preko 10 kartica nije veći nego prije faze (i dalje samo podrazumijevani Link).
- Ako je ruta proizvoda poslije izdvajanja datuma postala ISR u build tabeli, drugi HTML zahtjev istog sluga ima `Cache-Status` koji nije samo `fwd=bypass` ili ima kraći TTFB od prvog. Ako host i dalje kaže bypass, zapiši to i nemoj dodavati još prefetcha. Host tada ne skladišti dinamički segment; brzina ostaje na jeftinom RSC-u iz faza 02–04 i 06.

## Rollback

Vrati samo fajlove datuma/footera ako su dirani. Linkovi ostaju kako ih je faza 02 ostavila.

## Zabranjeno

- `router.prefetch` u petlji proizvoda
- prefetch pri `scroll`
- `generateStaticParams` koji čita svih 51.000 slugova tokom builda
- uključivanje `cacheComponents`
