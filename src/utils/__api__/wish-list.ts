import db from "data/product-database";

export const getWishListProducts = async (page = 1) => {
  const PAGE_SIZE = 6;
  const products = db.slice(0, 30);

  const currentProducts = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return { products: currentProducts, totalPages: Math.ceil(products.length / PAGE_SIZE) };
};
