// MUI
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
// LOCAL CUSTOM COMPONENTS
import ProductGallery from "./product-gallery";
import ProductIntroSidebar from "./product-intro-sidebar";
import ProductRating from "./product-rating";
// STYLED COMPONENTS
import { StyledRoot } from "./styles";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ================================================================
type Props = { product: Product };
// ================================================================

export default function ProductIntro({ product }: Props) {
  const images = product.images?.length ? product.images : [product.thumbnail || "/assets/images/placeholder.png"];
  const rating = product.rating ?? 0;

  return (
    <StyledRoot>
      <Grid container spacing={{ xs: 1, sm: 3 }} justifyContent="space-around">
        {/* IMAGE GALLERY: product.main_image as main gallery image */}
        <Grid size={{ lg: 6, md: 7, xs: 12 }}>
          <ProductGallery images={images} productName={product.title} productId={product.id} />
        </Grid>

        <Grid size={{ lg: 5, md: 5, xs: 12 }}>
          <Typography
            variant="h1"
            sx={{ fontSize: { xs: 22, sm: 26 }, lineHeight: 1.3 }}
          >
            {product.title}
          </Typography>

          {product.brand && (
            <Typography variant="body1" sx={{ mt: 1 }}>
              Brend: <strong>{product.brand}</strong>
            </Typography>
          )}

          <div className="rating">
            <span>Ocjena:</span>
            <ProductRating value={rating} />
            <Typography variant="h6">({rating.toFixed(1)})</Typography>
          </div>

          <ProductIntroSidebar product={product} />
        </Grid>
      </Grid>
    </StyledRoot>
  );
}
