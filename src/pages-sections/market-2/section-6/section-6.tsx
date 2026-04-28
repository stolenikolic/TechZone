import Typography from "@mui/material/Typography";
// CUSTOM COMPONENTS
import Container from "components/Container";
import ProductsCarousel from "./products-carousel";
import ProductCard17 from "components/product-cards/product-card-17";
// API FUNCTIONS
import api from "utils/__api__/market-2";

export default async function Section6() {
  const products = await api.getTopRatedProducts();
  if (!products || products.length === 0) return null;

  return (
    <Container>
      <Typography variant="h2" fontWeight={700} fontSize={{ sm: 32, xs: 27 }}>
        Top rated products
      </Typography>

      <ProductsCarousel>
        {products.map((product) => (
          <ProductCard17 key={product.id} product={product} />
        ))}
      </ProductsCarousel>
    </Container>
  );
}
