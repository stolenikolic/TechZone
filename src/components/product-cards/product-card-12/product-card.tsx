import Link from "next/link";
import Rating from "@mui/material/Rating";
// GLOBAL CUSTOM COMPONENTS
import LazyImage from "components/LazyImage";
// CUSTOM UTILS LIBRARY FUNCTIONS
import { calculateDiscount, formatPrice } from "lib";
// STYLED COMPONENTS
import { ImageWrapper, PriceText, Title } from "./styles";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ==============================================================
type Props = { product: Product };
// ==============================================================

export default function ProductCard12({ product }: Props) {
  const { slug, title, thumbnail, price, discount, rating } = product;

  return (
    <Link href={`/products/${slug}`}>
      <ImageWrapper>
        <LazyImage alt={title} width={380} height={379} src={thumbnail} />
      </ImageWrapper>

      <div>
        <Rating readOnly value={rating} size="small" precision={0.5} />
        <Title>{title}</Title>
        <PriceText>
          {calculateDiscount(price, discount)}
          {discount ? <span className="base-price">{formatPrice(price)}</span> : null}
        </PriceText>
      </div>
    </Link>
  );
}
