import Grid from "@mui/material/Grid";
// GLOBAL CUSTOM COMPONENTS
import ProductCard16 from "components/product-cards/product-card-16";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ========================================================
type Props = { products: Product[] };
// ========================================================

export default function ProductsGridView({ products }: Props) {
  return (
    <Grid container spacing={3} columns={{ xs: 4, md: 12, xl: 10 }}>
      {products.map((product: Product) => (
        <Grid size={{ xs: 2, md: 4, lg: 3, xl: 2 }} key={product.id} sx={{ display: "flex" }}>
          <ProductCard16 product={product} />
        </Grid>
      ))}
    </Grid>
  );
}

