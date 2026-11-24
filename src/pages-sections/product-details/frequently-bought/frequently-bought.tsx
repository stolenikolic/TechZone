import { Fragment } from "react";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
// LOCAL CUSTOM COMPONENT
import FrequentlyProductCard from "./frequently-product-card";
// CUSTOM UTILS LIBRARY FUNCTION
import { formatPrice } from "lib";
// CUSTOM DATA MODEL
import Product from "models/Product.model";
// STYLED COMPONENTS
import { Icon, StyledRoot, TotalCount } from "./styles";

// ============================================================
type Props = { products: Product[] };
// ============================================================

export default function FrequentlyBought({ products }: Props) {
  if (!products || !products.length) return null;

  const total = products.reduce((sum, item) => sum + (item.price || 0), 0);

  return (
    <StyledRoot>
      <Typography variant="h3" sx={{ mb: 3 }}>
        Često se kupuju zajedno
      </Typography>

      <div className="content-wrapper">
        {products.map((item, ind) => (
          <Fragment key={item.id}>
            <FrequentlyProductCard
              id={item.id}
              key={item.id}
              slug={item.slug}
              price={item.price}
              title={item.title}
              imgUrl={item.thumbnail}
            />

            {ind < products.length - 1 && <Icon>+</Icon>}
          </Fragment>
        ))}

        <Icon>=</Icon>

        <TotalCount>
          <Typography variant="h3" color="primary">
            {formatPrice(total)}
          </Typography>

          <div className="btn-wrapper">
            <Button variant="contained" color="primary">
              Dodaj u korpu
            </Button>

            <Button variant="outlined" color="primary">
              Dodaj u listu
            </Button>
          </div>
        </TotalCount>
      </div>
    </StyledRoot>
  );
}
