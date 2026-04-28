import Link from "next/link";
import Rating from "@mui/material/Rating";
// GLOBAL CUSTOM COMPONENTS
import LazyImage from "components/LazyImage";
// LOCAL CUSTOM COMPONENTS
import HoverActions from "./hover-actions";
// CUSTOM UTILS LIBRARY FUNCTION
import { formatPrice } from "lib";
// STYLED COMPONENTS
import { Card, CardMedia, CardContent } from "./styles";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ==============================================================
type Props = { product: Product };
// ==============================================================

export default function ProductCard8({ product }: Props) {
  const { slug, title, price, thumbnail, categories, reviews, rating } = product;

  return (
    <Card>
      <CardMedia>
        <Link href={`/products/${slug}`}>
          <LazyImage
            width={300}
            height={300}
            src={thumbnail}
            alt="category"
            className="product-img"
          />
        </Link>

        <HoverActions product={product} />
      </CardMedia>

      <CardContent>
        {/* PRODUCT CATEGORY */}
        {categories.length > 0 ? <p className="category">{categories[0]}</p> : null}

        {/* PRODUCT TITLE / NAME */}
        <p className="title">{title}</p>

        {/* PRODUCT PRICE */}
        <h4 className="price">{formatPrice(price)}</h4>

        {/* PRODUCT RATING / REVIEW */}
        <div className="ratings">
          <Rating readOnly value={rating} sx={{ fontSize: 16 }} />
          <p className="total">({reviews?.length || 0} Reviews)</p>
        </div>
      </CardContent>
    </Card>
  );
}
