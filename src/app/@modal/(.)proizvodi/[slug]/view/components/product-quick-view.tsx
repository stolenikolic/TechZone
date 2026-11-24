import Box from "@mui/material/Box";
import Rating from "@mui/material/Rating";
import Typography from "@mui/material/Typography";

import ButtonGroup from "./button-group";
import ImageCarousel from "./image-carousel";
import QuickViewModal from "./quick-view-modal";

import { formatPrice } from "lib";

import Product from "models/Product.model";

// =====================================================
type Props = { product: Product };
// =====================================================

export default function ProductQuickView({ product }: Props) {
  return (
    <QuickViewModal>
      <Box position="relative" bgcolor="grey.100">
        <ImageCarousel images={product.images!} title={product.title} />
      </Box>

      <Box py={3} px={4}>
        <Typography variant="body1" fontSize={22} fontWeight={600} sx={{ mb: 1 }}>
          {product.title}
        </Typography>

        <Typography variant="body1" fontSize={22} fontWeight={600}>
          {formatPrice(product.price)}
        </Typography>

        <Box display="flex" alignItems="center" gap={1} mb={3} mt={2}>
          <Rating size="small" color="warn" value={product.rating ?? 0} readOnly />
          <Typography variant="body1" lineHeight="1" color="text.secondary">
            ({product.rating?.toFixed(1) ?? "0.0"})
          </Typography>
        </Box>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          {product?.description || "Opis proizvoda trenutno nije dostupan."}
        </Typography>

        <ButtonGroup product={product} />
      </Box>
    </QuickViewModal>
  );
}
