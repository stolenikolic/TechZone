import type {
  HeroCarouselItem,
  HeroSideBannerItem,
  HomepagePayload,
  PromoBlockItem
} from "lib/homepage/types";

const HERO_CAROUSEL_FALLBACK: HeroCarouselItem[] = [
  {
    id: "fallback-hero-1",
    title: "Tech Deals",
    imgUrl: "/assets/images/hero/hero-1.jpg",
    category: "Electronics",
    buttonLink: "/products",
    buttonLabel: "EXPLORE NOW",
    description: "Discover the latest gadgets and tech essentials."
  },
  {
    id: "fallback-hero-2",
    title: "New Arrivals",
    imgUrl: "/assets/images/hero/hero-2.jpg",
    category: "Featured",
    buttonLink: "/products",
    buttonLabel: "EXPLORE NOW",
    description: "Explore new products and exclusive offers."
  }
];

const HERO_SIDE_FALLBACK: HeroSideBannerItem[] = [
  {
    id: "fallback-side-1",
    tag: "New Arrivals",
    title: "Winter Sale 20% OFF",
    imgUrl: "/assets/images/market-2/shoe-1.png",
    linkUrl: "/",
    buttonLabel: "EXPLORE NOW"
  },
  {
    id: "fallback-side-2",
    tag: "Accessories",
    title: "Airpods Pro 30% OFF",
    imgUrl: "/assets/images/market-2/airpods-1.png",
    linkUrl: "/",
    buttonLabel: "EXPLORE NOW"
  }
];

const PROMO_FALLBACK: PromoBlockItem[] = [
  {
    id: "fallback-promo-1",
    title: "Summer Collection",
    description:
      "Save up to 50% on summer essentials including swimwear, dresses, sandals, and accessories",
    imgUrl: "/assets/images/market-1/promo-1.jpg",
    buttonLink: "/products/search",
    buttonLabel: "Shop Now"
  },
  {
    id: "fallback-promo-2",
    title: "Spring Essentials",
    description:
      "Save up to 50% on spring essentials including jackets, rain boots, and seasonal accessories",
    imgUrl: "/assets/images/market-1/promo-2.jpg",
    buttonLink: "/products/search",
    buttonLabel: "Shop Now"
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
