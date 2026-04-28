import { uniq } from "lodash";
import products from "data/product-database";
import bazaarReactDatabase from "data/bazaar-react-database";
import { products as market2 } from "../market-2/data";
import { relatedProducts, frequentlyBoughtData } from "../related-products/data";

const dbProducts = [...bazaarReactDatabase, ...products];

const productList = [
  ...dbProducts,
  ...market2,
  ...relatedProducts,
  ...frequentlyBoughtData
];

export const uniqueProducts = uniq(productList.map((item) => item.slug)).map((item) =>
  productList.find((it) => it.slug === item)
);

export const slugs = uniqueProducts.map((item) => ({
  params: { slug: item?.slug as string }
}));

export const search = uniqueProducts.slice(0, 6).map((item) => item?.title);

export const reviews = [
  {
    name: "Jannie Schumm",
    imgUrl: "/assets/images/faces/7.png",
    rating: 4.7,
    date: "2021-02-14",
    comment:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Varius massa id ut mattis. Facilisis vitae gravida egestas ac account."
  },
  {
    name: "Joe Kenan",
    imgUrl: "/assets/images/faces/6.png",
    rating: 4.7,
    date: "2019-08-10",
    comment:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Varius massa id ut mattis. Facilisis vitae gravida egestas ac account."
  },
  {
    name: "Jenifer Tulia",
    imgUrl: "/assets/images/faces/8.png",
    rating: 4.7,
    date: "2019-02-10",
    comment:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Varius massa id ut mattis. Facilisis vitae gravida egestas ac account."
  }
];
