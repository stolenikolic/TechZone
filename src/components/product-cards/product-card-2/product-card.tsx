import Link from "next/link";
import Image from "next/image";
// MUI
import Box from "@mui/material/Box";
import Rating from "@mui/material/Rating";
import Typography from "@mui/material/Typography";
// LOCAL CUSTOM COMPONENTS
import ProductPrice from "../product-price";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ========================================================
interface Props {
  product: Product;
  showReview?: boolean;
}
// ========================================================

export default function ProductCard2({ product, showReview = true }: Props) {
  const { slug, title, price, thumbnail, rating, discount } = product;

  return (
    <div>
      <Link href={`/products/${slug}`}>
        <Box
          sx={{
            borderRadius: 3,
            position: "relative",
            backgroundColor: "grey.50",
            height: 370,
            img: { objectFit: "cover", objectPosition: "center" }
          }}
        >
          <Image
            fill
            alt={title}
            src={thumbnail}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </Box>
      </Link>

      <Box mt={2}>
        <Typography noWrap variant="h6" sx={{ mb: 0.5 }}>
          {title}
        </Typography>

        {showReview && <Rating size="small" value={rating} color="warn" readOnly />}

        <ProductPrice price={price} discount={discount} />
      </Box>
    </div>
  );
}
