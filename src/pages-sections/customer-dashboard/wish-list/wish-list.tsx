import { Fragment } from "react";
import Grid from "@mui/material/Grid";
import Favorite from "@mui/icons-material/Favorite";
// CUSTOM COMPONENTS
import Pagination from "../pagination";
import DashboardHeader from "../dashboard-header";
import ProductCard17 from "components/product-cards/product-card-17";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ==================================================================
interface Props {
  totalPages: number;
  products: Product[];
}
// ==================================================================

export default function WishListPageView({ products, totalPages }: Props) {
  return (
    <Fragment>
      <DashboardHeader title="My Wish List" Icon={Favorite} />

      <Grid container spacing={3}>
        {products.map((product) => (
          <Grid size={{ lg: 4, sm: 6, xs: 12 }} key={product.id}>
            <ProductCard17 bgWhite product={product} />
          </Grid>
        ))}
      </Grid>

      <Pagination count={totalPages} />
    </Fragment>
  );
}
