import type { HomepageZone } from "lib/homepage/zones";

export type HeroCarouselContent = {
  title: string;
  categoryLabel: string;
  description: string;
  buttonLink: string;
  buttonLabel: string;
};

export type HeroSideContent = {
  tag: string;
  title: string;
  linkUrl: string;
  buttonLabel: string;
};

export type PromoContent = {
  title: string;
  description: string;
  buttonLink: string;
  buttonLabel: string;
};

export type HomepageBlockContent = HeroCarouselContent | HeroSideContent | PromoContent;

export type DbHomepageBlock = {
  id: string;
  zone: HomepageZone;
  sort_order: number;
  is_active: boolean;
  image_url: string | null;
  content: HomepageBlockContent;
  created_at: string;
  updated_at: string;
};

export type HeroCarouselItem = {
  id: string;
  title: string;
  imgUrl: string;
  category: string;
  buttonLink: string;
  buttonLabel: string;
  description: string;
};

export type HeroSideBannerItem = {
  id: string;
  tag: string;
  title: string;
  imgUrl: string;
  linkUrl: string;
  buttonLabel: string;
};

export type PromoBlockItem = {
  id: string;
  title: string;
  description: string;
  imgUrl: string;
  buttonLink: string;
  buttonLabel: string;
};

export type HomepagePayload = {
  heroCarousel: HeroCarouselItem[];
  heroSide: HeroSideBannerItem[];
  promo: PromoBlockItem[];
};
