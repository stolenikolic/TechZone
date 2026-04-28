import Image from "next/image";
import Typography from "@mui/material/Typography";
// STYLED COMPONENTS
import { CardRoot, PriceText, SaleBadge } from "./styles";
// CUSTOM UTILS LIBRARY FUNCTIONS
import { calculateDiscount, formatPrice } from "lib";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ==============================================================
type Props = { product: Product };
// ==============================================================

export default function ProductCard11({ product }: Props) {
  const { title, discount, thumbnail, price } = product;

  const hasDiscount = discount > 0;

  return (
    <CardRoot elevation={0}>
      {hasDiscount && (
        <SaleBadge>
          <p>Sale!</p>
        </SaleBadge>
      )}

      <div className="img-wrapper">
        <Image fill sizes="(100vw, 340px)" alt="Apple Watch" src={thumbnail} />
      </div>

      <div className="content">
        {/* PRODUCT TITLE & REGULAR PRICE */}
        <div className="flex-between">
          <Typography noWrap variant="body1" fontWeight={600} fontSize={18}>
            {title}
          </Typography>

          {hasDiscount && <PriceText>{formatPrice(price)}</PriceText>}
        </div>

        {/* DESCRIPTION & SALE PRICE */}
        <div className="flex-between">
          <Typography noWrap variant="body1" color="grey.600">
            Powerful sensors, advanced
          </Typography>

          <Typography noWrap variant="body1" fontWeight={600} lineHeight={1.2} fontSize={18}>
            {calculateDiscount(price, discount)}
          </Typography>
        </div>
      </div>
    </CardRoot>
  );
}
