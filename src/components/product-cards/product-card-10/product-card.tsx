import Link from "next/link";
import Rating from "@mui/material/Rating";
// CUSTOM COMPONENTS
import AddToCart from "./add-to-cart";
import HoverActions from "./hover-actions";
import LazyImage from "components/LazyImage";
// STYLED COMPONENTS
import { Card, CardMedia, CardContent } from "./styles";
// CUSTOM UTILS LIBRARY FUNCTION
import { formatPrice } from "lib";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ==============================================================
type Props = { product: Product };
// ==============================================================

export default function ProductCard10({ product }: Props) {
  const { slug, price, rating, thumbnail, title, reviews } = product;

  return (
    <Card>
      <CardMedia>
        <Link href={`/products/${slug}`} aria-label={`View details for ${title}`}>
          <LazyImage width={300} height={300} alt={title} src={thumbnail} className="product-img" />
        </Link>

        <HoverActions slug={slug} />
      </CardMedia>

      <CardContent>
        <p className="title">{title}</p>
        <p className="price">{formatPrice(price)}</p>

        <div className="ratings">
          <Rating name="read-only" value={rating || 4} readOnly />
          <p className="amount">({reviews?.length || 0})</p>
        </div>

        <AddToCart product={product} />
      </CardContent>
    </Card>
  );
}
