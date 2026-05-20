import Link from "next/link";
import Image from "next/image";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Discount from "./discount";
import HoverActions from "./hover-actions";
import { ImageWrapper, ImageContainer, ContentWrapper, StyledCard } from "./styles";
import Product from "models/Product.model";
import { formatPrice } from "lib";

type Props = {
  product: Product;
  bgWhite?: boolean;
  showRemoveFromWishlist?: boolean;
};

export default function ProductCard17({
  product,
  bgWhite = false,
  showRemoveFromWishlist = false
}: Props) {
  const { slug, title, price, thumbnail, images, discount, categories, originalPrice, isUnavailable } = product;
  const showOriginal = originalPrice != null && originalPrice > price;

  return (
    <StyledCard
      elevation={0}
      bgWhite={bgWhite}
      sx={
        isUnavailable
          ? {
              opacity: 0.75,
              ".thumbnail, .hover-thumbnail": { filter: "grayscale(1)" }
            }
          : undefined
      }
    >
      <ImageWrapper>
        <Discount discount={discount} />
        {isUnavailable ? (
          <Chip
            size="small"
            color="default"
            label="Nedostupan"
            sx={{ position: "absolute", left: 16, top: 16, zIndex: 2 }}
          />
        ) : null}
        <HoverActions
          product={product}
          showRemoveFromWishlist={showRemoveFromWishlist}
          disableAddToCart={isUnavailable}
        />

        <Link href={`/products/${slug}`} aria-label={`Pogledaj ${title}`}>
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

        <Link href={`/products/${slug}`} aria-label={`Pogledaj ${title}`}>
          <Typography variant="h5" className="title">
            {title}
          </Typography>
        </Link>

        <div className="price-group">
          {showOriginal ? (
            <Typography
              component="span"
              variant="body2"
              className="original-price"
              sx={{ color: "primary.main", textDecoration: "line-through", fontWeight: 500 }}
            >
              {formatPrice(originalPrice)}
            </Typography>
          ) : null}
          <Typography
            variant="subtitle1"
            className="effective-price"
            fontWeight={600}
            sx={{ color: "price.main" }}
          >
            {formatPrice(price)}
          </Typography>
        </div>
      </ContentWrapper>
    </StyledCard>
  );
}
