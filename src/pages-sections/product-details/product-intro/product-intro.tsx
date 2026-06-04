// MUI
import Grid from "@mui/material/Grid";
import Rating from "@mui/material/Rating";
import Typography from "@mui/material/Typography";
// LOCAL CUSTOM COMPONENTS
import ProductGallery from "./product-gallery";
import ProductIntroSidebar from "./product-intro-sidebar";
// STYLED COMPONENTS
import { StyledRoot } from "./styles";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ================================================================
type Props = { product: Product };
// ================================================================

export default function ProductIntro({ product }: Props) {
  const images = product.images?.length ? product.images : [product.thumbnail || "/assets/images/placeholder.png"];

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

          <ProductIntroSidebar product={product} />
        </Grid>
      </Grid>
    </StyledRoot>
  );
}
