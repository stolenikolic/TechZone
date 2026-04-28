import Link from "next/link";
import Image from "next/image";
import Typography from "@mui/material/Typography";
// LOCAL CUSTOM COMPONENTS
import Discount from "./discount";
import HoverActions from "./hover-actions";
// STYLED COMPONENTS
import { ImageWrapper, ImageContainer, ContentWrapper, StyledCard } from "./styles";
// CUSTOM DATA MODEL
import Product from "models/Product.model";
// CUSTOM UTILS FUNCTION
import { formatPrice } from "lib";

// ========================================================
interface Props {
  product: Product;
  bgWhite?: boolean;
}
// ========================================================

export default function ProductCard17({ product, bgWhite = false }: Props) {
  const { slug, title, price, thumbnail, images, discount, categories } = product;

  return (
    <StyledCard elevation={0} bgWhite={bgWhite}>
      <ImageWrapper>
        <Discount discount={discount} />
        <HoverActions product={product} />

        <Link href={`/products/${slug}`} aria-label={`View ${title}`}>
          <ImageContainer>
            <Image
              src={thumbnail}
              alt={`Thumbnail for ${title}`}
              fill
              className={images.length > 1 ? "thumbnail" : ""}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              loading={images.length > 1 ? "lazy" : "eager"}
              style={{ objectFit: "contain" }}
            />
            {images.length > 1 && (
              <Image
                src={images[1]}
                loading="lazy"
                className="hover-thumbnail"
                alt={`Hover thumbnail for ${title}`}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                style={{ objectFit: "contain" }}
              />
            )}
          </ImageContainer>
        </Link>
      </ImageWrapper>

      <ContentWrapper>
        <Typography noWrap variant="body2" className="category">
          {categories.length > 0 ? categories[0] : "N/A"}
        </Typography>

        <Link href={`/products/${slug}`} aria-label={`View ${title}`}>
          <Typography noWrap variant="h5" className="title">
            {title}
          </Typography>
        </Link>

        <Typography variant="subtitle1" fontWeight={600} sx={{ color: "price.main" }}>
          {formatPrice(price)}
        </Typography>
      </ContentWrapper>
    </StyledCard>
  );
}
