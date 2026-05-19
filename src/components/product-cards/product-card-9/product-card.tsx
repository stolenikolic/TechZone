import Link from "next/link";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import LazyImage from "components/LazyImage";
// LOCAL CUSTOM COMPONENTS
import DiscountChip from "../discount-chip";
import ProductPrice from "../product-price";
import ProductTags from "./components/tags";
import AddToCartButton from "./components/add-to-cart";
import FavoriteButton from "./components/favorite-button";
// CUSTOM DATA MODEL
import Product from "models/Product.model";
// STYLED COMPONENT
import { ContentWrapper, Wrapper } from "./styles";

// ===========================================================
type Props = { product: Product };
// ===========================================================

function categoryLabel(category: unknown): string {
  if (typeof category === "string") return category.trim();
  if (category && typeof category === "object") {
    const o = category as { title?: string; name?: string };
    const t = typeof o.title === "string" ? o.title : typeof o.name === "string" ? o.name : "";
    return t.trim();
  }
  return "";
}

/** List row meta: brand + product categories from data (replacing template placeholders). */
function buildProductCardTags(product: Product): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const track = (label: string) => {
    const n = label.trim();
    if (!n) return;
    const key = n.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    ordered.push(n);
  };
  const brand = product.brand?.trim();
  if (brand) track(brand);
  if (Array.isArray(product.categories)) {
    for (const c of product.categories) {
      const lbl = categoryLabel(c);
      if (lbl) track(lbl);
    }
  }
  return ordered;
}

export default function ProductCard9({ product }: Props) {
  const { thumbnail, title, price, discount, slug, topPick, topPickLabel, originalPrice } = product;
  const tags = buildProductCardTags(product);

  return (
    <Wrapper
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
      {/* PRODUCT FAVORITE BUTTON */}
      <FavoriteButton />

      <ContentWrapper>
        <div className="img-wrapper">
          {/* DISCOUNT PERCENT CHIP IF AVAILABLE */}
          <DiscountChip discount={discount} />
          {topPick ? (
            <Chip
              size="small"
              color="info"
              label={topPickLabel ?? "Top pick"}
              sx={{ position: "absolute", left: 15, top: discount ? 44 : 15, zIndex: 1 }}
            />
          ) : null}

          {/* PRODUCT IMAGE / THUMBNAIL */}
          <LazyImage src={thumbnail} alt={title} width={500} height={500} />
        </div>

        <div className="content">
          <div>
            {tags.length > 0 ? <ProductTags tags={tags} /> : null}

            {/* PRODUCT TITLE / NAME */}
            <Link href={`/products/${slug}`}>
              <Typography variant="h5" sx={{ mt: 1, mb: 2 }}>
                {title}
              </Typography>
            </Link>

            {/* PRODUCT PRICE */}
            <ProductPrice price={price} discount={discount} originalPrice={originalPrice} />
          </div>

          {/* PRODUCT ADD TO CART BUTTON */}
          <AddToCartButton product={product} />
        </div>
      </ContentWrapper>
    </Wrapper>
  );
}
