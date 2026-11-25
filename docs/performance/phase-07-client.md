# Faza 07 — manje JavaScripta na shopu

Radi se kad su stranice već jeftine na serveru. Ova faza ne smanjuje TTFB baze. Smanjuje hidraciju.

## 7.1 Date picker nije globalan

`src/theme/theme-provider.tsx` je client komponenta iznad cijelog sajta i uvlači `@mui/x-date-pickers` `LocalizationProvider` i `date-fns/locale/bs` na shop, gdje nema date pickera.

Izmjestiti `LocalizationProvider` u layout koji stvarno ima picker (admin forme). Shop `ThemeProvider` zadržava `AppRouterCacheProvider`, `ThemeProvider` iz MUI i `CssBaseline`.

Prije brisanja importa, `rg "LocalizationProvider|DatePicker" src` i ostavi provider na svakom layoutu čiji ekran ima picker. Ako je picker samo u adminu, omotaj `(admin-dashboard)/layout.tsx`. Ako ga nema nigdje na živom UI, ukloni provider potpuno.

## 7.2 Ikonice

`src/icons/index.ts` sklapa oko 157 ikona i `IconComponent` ga uvozi. Na shopu se koristi iz menija kategorija i homepage servisa.

Ne prepisuj sve ikone. Za shop meni proslijedi već postojeći string `icon` i u `category-list-item` importuj samo one komponente koje `CATEGORY_ICON_BY_SLUG` u `layout-data.ts` stvarno koristi (Microchip, Headset, Desktop, HouseSignal, Robot, MicrophoneLines, MobileNotch, Camera, Gear, Laptop). Taj fajl neka importa te module direktno, ne preko `icons/index.ts`.

`IconComponent` ostaje za admin i ostale teme. Ne briši `icons/index.ts`.

## 7.3 Listing shell

`CategoryProductsSection` je cijela client komponenta iako je grid čist prikaz. U ovoj fazi nemoj je cijepati na server grid ako filter i dalje traži `useSearchParams` u istom stablu. Cijepanje bez Suspense granice pokvari statički shell u fazi 08.

Dozvoljena izmjena: `useTransition` oko `router.push` u filteru i sortu, tako da stari grid ostane na ekranu dok RSC stiže. `isPending` smanji opacity grida na 0.6. Ne briši stare proizvode prije odgovora. To je jedina „optimistic“ izmjena. Cijene se ne pogađaju na klijentu.

`useDeferredValue` ne dodavati na listu proizvoda; lista ionako stiže sa servera.

## 7.4 Šta ne vaditi iz client bundlea „zasad“

- `CartProvider` ostaje u rootu. Korpa je na svakoj shop stranici. Ne defer-uj ga iza idle-a u ovoj fazi; lako pokvariš hidraciju bedža.
- ApexCharts i `react-insta-stories` se ne uvoze na shopu. Ne diraj dependency dok admin radi.
- `overlayscrollbars` CSS ostaje dok se ne izmjeri poseban CSS diff. Nije prvi kilobajt.

## Uspjeh

`npm run build` i uporedi First Load JS za `/` i `/kategorije/[...slug]` sa brojevima iz `build-route-table.txt` prije ove faze. Cilj je manji shop chunk, ne tačan procenat. Ako razlika nije bar 20 KB gzip na jednoj od te dvije rute, faza nije uspjela i vraća se; nemoj je ostavljati zbog `useTransition` samog.

## Rollback

Vrati tri grupe fajlova: theme layout, category list item, filter transition. Nema migracije.
