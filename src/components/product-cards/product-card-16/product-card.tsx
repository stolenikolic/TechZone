import Link from "next/link";
import Image from "next/image";
import Chip from "@mui/material/Chip";
import Rating from "@mui/material/Rating";
import Typography from "@mui/material/Typography";
// LOCAL CUSTOM COMPONENTS
import AddToCart from "./add-to-cart";
import DiscountChip from "../discount-chip";
// CUSTOM UTILS LIBRARY FUNCTIONS
import { calculateDiscount, formatPrice } from "lib";
// STYLED COMPONENTS
import { PriceText, StyledRoot } from "./styles";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ==============================================================
type Props = { product: Product };
// ==============================================================

export default function ProductCard16({ product }: Props) {
  const { slug, title, thumbnail, price, discount, rating, topPick, topPickLabel } = product;

  return (
    <StyledRoot
      style={
        topPick
          ? {
              borderWidth: 2,
              borderColor: "var(--mui-palette-info-main)",
              boxShadow: "0 0 0 1px rgba(3, 169, 244, 0.2), 0 8px 18px rgba(3, 169, 244, 0.14)"
            }
          : undefined
      }
    >
      <Link href={`/products/${slug}`}>
        <div className="img-wrapper">
          <Image
            src={thumbnail}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 380px"
            style={{ objectFit: "contain" }}
          />
          {topPick ? (
            <Chip
              size="small"
              color="info"
              label={topPickLabel ?? "Top pick"}
              sx={{ position: "absolute", left: 20, top: discount ? 48 : 20, zIndex: 1 }}
            />
          ) : null}
          {discount ? <DiscountChip discount={discount} sx={{ left: 20, top: 20 }} /> : null}
        </div>
      </Link>

      <div className="content">
        <div className="content-main">
          <Link href={`/products/${slug}`}>
            <Typography variant="h6" className="product-title">
              {title}
            </Typography>
          </Link>

          <Rating readOnly value={rating} size="small" precision={0.5} />
        </div>

        <div className="content-footer">
          <PriceText>
            {calculateDiscount(price, discount)}
            {discount ? <span className="base-price">{formatPrice(price)}</span> : null}
          </PriceText>
          <AddToCart product={product} />
        </div>
      </div>
    </StyledRoot>
  );
}
