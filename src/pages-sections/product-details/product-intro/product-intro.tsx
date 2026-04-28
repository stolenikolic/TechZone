// MUI
import Grid from "@mui/material/Grid";
import Rating from "@mui/material/Rating";
import Typography from "@mui/material/Typography";
// LOCAL CUSTOM COMPONENTS
import ProductGallery from "./product-gallery";
import ProductPurchaseBlock from "./product-purchase-block";
// CUSTOM UTILS LIBRARY FUNCTION
import { formatPrice } from "lib";
// STYLED COMPONENTS
import { StyledRoot } from "./styles";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ================================================================
type Props = { product: Product };
// ================================================================

export default function ProductIntro({ product }: Props) {
  const images = product.images?.length ? product.images : [product.thumbnail || "/assets/images/placeholder.png"];
  const showPricePlaceholder = product.price == null || product.price === 0;

  return (
    <StyledRoot>
      <Grid container spacing={3} justifyContent="space-around">
        {/* IMAGE GALLERY: product.main_image as main gallery image */}
        <Grid size={{ lg: 6, md: 7, xs: 12 }}>
          <ProductGallery images={images} productName={product.title} />
        </Grid>

        <Grid size={{ lg: 5, md: 5, xs: 12 }}>
          <Typography variant="h1">{product.title}</Typography>

          {product.brand && (
            <Typography variant="body1" sx={{ mt: 1 }}>
              Brand: <strong>{product.brand}</strong>
            </Typography>
          )}

          <div className="rating">
            <span>Rated:</span>
            <Rating readOnly color="warn" size="small" value={product.rating ?? 0} />
            <Typography variant="h6">({(product.rating ?? 0).toFixed(1)})</Typography>
          </div>

          <div className="price">
            {showPricePlaceholder ? (
              <Typography variant="h2" sx={{ color: "price.main", mb: 0.5, lineHeight: 1 }}>
                Price on request
              </Typography>
            ) : product.originalPrice != null && product.originalPrice > product.price ? (
              <>
                <Typography
                  component="span"
                  sx={{
                    fontSize: 16,
                    fontWeight: 500,
                    color: "text.secondary",
                    textDecoration: "line-through",
                    marginRight: 1
                  }}
                >
                  {formatPrice(product.originalPrice)}
                </Typography>
                <Typography variant="h2" sx={{ color: "price.main", fontWeight: 700, mb: 0.5, lineHeight: 1 }}>
                  {formatPrice(product.price)}
                </Typography>
              </>
            ) : (
              <Typography variant="h2" sx={{ color: "price.main", fontWeight: 700, mb: 0.5, lineHeight: 1 }}>
                {formatPrice(product.price)}
              </Typography>
            )}
          </div>

          <ProductPurchaseBlock product={product} />
        </Grid>
      </Grid>
    </StyledRoot>
  );
}
