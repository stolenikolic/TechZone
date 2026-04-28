import Product from "./Product.model";

export interface MainCarouselItem {
  id: number;
  title: string;
  imgUrl: string;
  category: string;
  buttonLink: string;
  description: string;
}

export interface CategoryBasedProducts {
  products: Product[];
  category: { title: string; children: string[] };
}
