import Link from "next/link";
import Image from "next/image";
// MUI
import Rating from "@mui/material/Rating";
import Typography from "@mui/material/Typography";
// CUSTOM COMPONENTS
import Star from "icons/Star";
import AddToCart from "./add-to-cart";
// CUSTOM UTILS LIBRARY FUNCTIONS
import { calculateDiscount, formatPrice } from "lib";
// STYLED COMPONENTS
import { Content, PriceText, StyledChip, StyledRoot } from "./styles";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ==============================================================
type Props = { product: Product };
// ==============================================================

export default function ProductCard14({ product }: Props) {
  const { slug, title, thumbnail, price, discount, rating } = product;

  return (
    <StyledRoot>
      <Link href={`/products/${slug}`}>
        <div className="img-wrapper">
          {discount > 0 && <StyledChip size="small" label={`${discount}% off`} />}

          <Image
            fill
            alt={title}
            src={thumbnail}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            quality={75}
          />
        </div>
      </Link>

      <Content>
        <Rating
          readOnly
          size="small"
          value={rating}
          icon={<Star fontSize="inherit" />}
          emptyIcon={<Star fontSize="inherit" />}
        />

        <Typography noWrap variant="body1" fontSize={16} fontWeight={500}>
          {title}
        </Typography>

        <PriceText>
          {calculateDiscount(price, discount)}
          {discount ? <span className="base-price">{formatPrice(price)}</span> : null}
        </PriceText>

        <AddToCart product={product} />
      </Content>
    </StyledRoot>
  );
}
