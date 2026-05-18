import Product from "./Product.model";

export interface MainCarouselItem {
  id: string;
  title: string;
  imgUrl: string;
  category: string;
  buttonLink: string;
  buttonLabel: string;
  description: string;
}

export interface CategoryBasedProducts {
  products: Product[];
  category: { title: string; children: string[] };
}
