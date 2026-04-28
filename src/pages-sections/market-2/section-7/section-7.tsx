import Grid from "@mui/material/Grid";
// CUSTOM COMPONENTS
import Sidebar from "./sidebar";
import Container from "components/Container";
import FlexBox from "components/flex-box/flex-box";
import ProductCard17 from "components/product-cards/product-card-17";
// API FUNCTIONS
import api from "utils/__api__/market-2";

export default async function Section7() {
  const [products, shops, brands] = await Promise.all([
    api.getProducts(),
    api.getShops(),
    api.getBrands()
  ]);

  if (!products || products.length === 0) return null;

  return (
    <Container>
      <FlexBox gap="1.75rem" position="relative">
        {brands && shops && <Sidebar brands={brands} shops={shops} />}

        <Grid container spacing={3}>
          {products.map((product) => (
            <Grid size={{ lg: 4, sm: 6, xs: 12 }} key={product.id}>
              <ProductCard17 product={product} />
            </Grid>
          ))}
        </Grid>
      </FlexBox>
    </Container>
  );
}
