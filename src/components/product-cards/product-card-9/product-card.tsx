import Link from "next/link";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import LazyImage from "components/LazyImage";
import { calculateDiscount, formatPrice } from "lib";
// LOCAL CUSTOM COMPONENTS
import DiscountChip from "../discount-chip";
import AddToCartButton from "./components/add-to-cart";
import FavoriteButton from "./components/favorite-button";
// CUSTOM DATA MODEL
import Product from "models/Product.model";
// STYLED COMPONENT
import { ContentWrapper, Wrapper } from "./styles";

// ===========================================================
type Props = { product: Product };
type PriceProps = { price: number; discount: number; originalPrice?: number };
// ===========================================================

/** List-only price. Side by side while both fit; when they wrap, the struck price stays above. */
function ListProductPrice({ price, discount, originalPrice }: PriceProps) {
  const showOriginal = originalPrice != null && originalPrice > price;
  const showDiscount = !showOriginal && discount > 0;
  const current = showDiscount ? calculateDiscount(price, discount) : formatPrice(price);
  const struck = showOriginal ? formatPrice(originalPrice) : showDiscount ? formatPrice(price) : null;

  return (
    <div className="list-price">
      {struck ? (
        <Box component="del" className={showOriginal ? "list-price-was list-price-was--original" : "list-price-was"}>
          {struck}
        </Box>
      ) : null}
      <span className="list-price-now">{current}</span>
    </div>
  );
}

export default function ProductCard9({ product }: Props) {
  const { thumbnail, title, price, discount, slug, topPick, topPickLabel, originalPrice } = product;

  return (
    <Wrapper
      elevation={0}
      sx={
        topPick
          ? {
              border: "2px solid",
              borderColor: "info.main",
              boxShadow: "0 0 0 1px rgba(3, 169, 244, 0.2), 0 8px 18px rgba(3, 169, 244, 0.14)"
            }
          : undefined
      }
    >
      <ContentWrapper>
        <div className="img-wrapper">
          <DiscountChip discount={discount} sx={{ display: { xs: "none", sm: "inline-flex" } }} />
          {topPick ? (
            <Chip
              size="small"
              color="info"
              label={topPickLabel ?? "Izdvojeno"}
              sx={{
                display: { xs: "none", sm: "inline-flex" },
                position: "absolute",
                left: 15,
                top: discount ? 44 : 15,
                zIndex: 1
              }}
            />
          ) : null}

          <LazyImage src={thumbnail} alt={title} width={150} height={150} />
        </div>

        <div className="content">
          <div className="copy">
            <Link href={`/proizvodi/${slug}`}>
              <Typography className="product-title" variant="h5" sx={{ mt: 0, mb: 0 }}>
                {title}
              </Typography>
            </Link>

            <ListProductPrice price={price} discount={discount} originalPrice={originalPrice} />
          </div>

          <div className="actions">
            <FavoriteButton productId={product.id} />
            <AddToCartButton product={product} />
          </div>
        </div>
      </ContentWrapper>
    </Wrapper>
  );
}
