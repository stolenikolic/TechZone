import type {
  HeroCarouselItem,
  HeroSideBannerItem,
  HomepagePayload,
  PromoBlockItem
} from "lib/homepage/types";

const HERO_CAROUSEL_FALLBACK: HeroCarouselItem[] = [
  {
    id: "fallback-hero-1",
    title: "Tehnološke akcije",
    imgUrl: "/assets/images/hero/hero-1.jpg",
    category: "Elektronika",
    buttonLink: "/pretraga",
    buttonLabel: "POGLEDAJ PONUDU",
    description: "Najnoviji uređaji i oprema na jednom mjestu."
  },
  {
    id: "fallback-hero-2",
    title: "Novo u ponudi",
    imgUrl: "/assets/images/hero/hero-2.jpg",
    category: "Izdvojeno",
    buttonLink: "/pretraga",
    buttonLabel: "POGLEDAJ PONUDU",
    description: "Novi proizvodi i posebne ponude."
  }
];

const HERO_SIDE_FALLBACK: HeroSideBannerItem[] = [
  {
    id: "fallback-side-1",
    tag: "Novo",
    title: "Zimska akcija 20%",
    imgUrl: "/assets/images/market-2/shoe-1.png",
    linkUrl: "/",
    buttonLabel: "POGLEDAJ PONUDU"
  },
  {
    id: "fallback-side-2",
    tag: "Dodaci",
    title: "AirPods Pro 30% popusta",
    imgUrl: "/assets/images/market-2/airpods-1.png",
    linkUrl: "/",
    buttonLabel: "POGLEDAJ PONUDU"
  }
];

const PROMO_FALLBACK: PromoBlockItem[] = [
  {
    id: "fallback-promo-1",
    title: "Ljetna kolekcija",
    description:
      "Uštedite do 50% na ljetnim artiklima: kupaći kostimi, haljine, sandale i dodaci.",
    imgUrl: "/assets/images/market-1/promo-1.jpg",
    buttonLink: "/pretraga",
    buttonLabel: "Kupi odmah"
  },
  {
    id: "fallback-promo-2",
    title: "Proljetni artikli",
    description:
      "Uštedite do 50% na proljetnim artiklima: jakne, čizme i sezonski dodaci.",
    imgUrl: "/assets/images/market-1/promo-2.jpg",
    buttonLink: "/pretraga",
    buttonLabel: "Kupi odmah"
  }
];

export function withHomepageFallbacks(payload: HomepagePayload): HomepagePayload {
  return {
    heroCarousel: payload.heroCarousel.length > 0 ? payload.heroCarousel : HERO_CAROUSEL_FALLBACK,
    heroSide: payload.heroSide.length > 0 ? payload.heroSide : HERO_SIDE_FALLBACK,
    promo: payload.promo.length > 0 ? payload.promo : PROMO_FALLBACK
  };
}

export { HERO_CAROUSEL_FALLBACK, HERO_SIDE_FALLBACK, PROMO_FALLBACK };
