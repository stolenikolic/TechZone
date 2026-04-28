import Link from "next/link";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import LazyImage from "components/LazyImage";
import { NavLink } from "components/nav-link";
// STYLED COMPONENT
import { RootStyle } from "./styles";
// CUSTOM UTILS LIBRARY FUNCTIONS
import { calculateDiscount, formatPrice } from "lib";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ===========================================
type Props = { product: Product };
// ===========================================

export default function ProductCard({ product }: Props) {
  const { slug, thumbnail, title, price, discount, categories } = product || {};

  return (
    <RootStyle>
      <Link href={`/products/${slug}`}>
        <div className="img-wrapper">
          <LazyImage width={100} height={100} alt="product" src={thumbnail} />
        </div>
      </Link>

      <div className="content">
        {categories.length ? (
          <Typography variant="body1" sx={{ fontSize: 12, color: "grey.600" }}>
            {categories[0]}
          </Typography>
        ) : null}

        <NavLink href="/">
          <Typography noWrap variant="h6">
            {title}
          </Typography>
        </NavLink>

        <Typography variant="h5" sx={{ mt: 1, fontWeight: 600 }}>
          {calculateDiscount(price, discount)}

          {discount ? (
            <Typography ml={1} component="del" sx={{ ml: 1, color: "grey.600", fontWeight: 500 }}>
              {formatPrice(price)}
            </Typography>
          ) : null}
        </Typography>
      </div>
    </RootStyle>
  );
}
