import Box from "@mui/material/Box";
// GLOBAL CUSTOM COMPONENTS
import ProductCard16 from "components/product-cards/product-card-16";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ========================================================
type Props = { products: Product[] };
// ========================================================

export default function ProductsGridView({ products }: Props) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 3,
        width: "100%",
        gridTemplateColumns: {
          xs: "repeat(2, minmax(0, 1fr))",
          md: "repeat(3, minmax(0, 1fr))",
          lg: "repeat(4, minmax(0, 1fr))",
          xl: "repeat(5, minmax(0, 1fr))"
        }
      }}
    >
      {products.map((product: Product) => (
        <Box key={product.id} sx={{ display: "flex", minWidth: 0 }}>
          <ProductCard16 product={product} />
        </Box>
      ))}
    </Box>
  );
}
