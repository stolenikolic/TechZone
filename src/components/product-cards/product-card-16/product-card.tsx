import Link from "next/link";
import Image from "next/image";
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
  const { slug, title, thumbnail, price, discount, rating } = product;

  return (
    <StyledRoot>
      <Link href={`/products/${slug}`}>
        <div className="img-wrapper">
          <Image
            src={thumbnail}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 380px"
            style={{ objectFit: "contain" }}
          />
          {discount ? <DiscountChip discount={discount} sx={{ left: 20, top: 20 }} /> : null}
        </div>
      </Link>

      <div className="content">
        <div>
          <Link href={`/products/${slug}`}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              {title}
            </Typography>
          </Link>

          <Rating readOnly value={rating} size="small" precision={0.5} />

          <PriceText>
            {calculateDiscount(price, discount)}
            {discount ? <span className="base-price">{formatPrice(price)}</span> : null}
          </PriceText>
        </div>

        {/* ADD TO CART BUTTON */}
        <AddToCart product={product} />
      </div>
    </StyledRoot>
  );
}
