import ProductCard9 from "components/product-cards/product-card-9";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ==========================================================
type Props = { products: Product[] };
// ==========================================================

export default function ProductsListView({ products }: Props) {
  return products.map((product) => <ProductCard9 key={product.id} product={product} />);
}
