import Image from "next/image";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Delete from "@mui/icons-material/Delete";
import { FlexBetween, FlexBox } from "components/flex-box";
import { formatCartDeliverySubtitle } from "lib/cart/cart-line-id";
import { currency } from "lib";
import Order from "models/Order.model";

type Props = { product: Order["items"][0] };

export default function OrderedProduct({ product }: Props) {
  const {
    product_img,
    product_name,
    product_price,
    product_quantity,
    supplier_name,
    offer_label,
    delivery_label
  } = product || {};

  const supplierDisplay = supplier_name?.trim() ? supplier_name.trim() : "–";
  const offerDisplay = offer_label?.trim() ? offer_label.trim() : "–";
  const deliveryDisplay = formatCartDeliverySubtitle(delivery_label ?? undefined);

  return (
    <Box my={2} gap={2} display="grid" gridTemplateColumns={{ md: "1fr 1fr", xs: "1fr" }}>
      <FlexBox flexShrink={0} gap={1.5} alignItems="center">
        <Avatar variant="rounded" sx={{ height: 64, width: 64 }}>
          <Image fill alt={product_name} src={product_img} sizes="(64px, 64px)" />
        </Avatar>

        <div>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {product_name}
          </Typography>

          <FlexBox alignItems="center" gap={1}>
            <Typography variant="body1" sx={{ color: "grey.600" }}>
              {currency(product_price)} x
            </Typography>

            <Box maxWidth={60}>
              <TextField defaultValue={product_quantity} type="number" fullWidth />
            </Box>
          </FlexBox>
        </div>
      </FlexBox>

      <FlexBetween flexShrink={0} alignItems="flex-start" columnGap={2}>
        <div>
          <Typography variant="body1" sx={{ color: "grey.600", display: "block" }}>
            Opcija kupovine: {offerDisplay}
          </Typography>
          {deliveryDisplay ? (
            <Typography variant="body2" sx={{ color: "grey.600", mt: 0.5 }}>
              Rok isporuke: {deliveryDisplay}
            </Typography>
          ) : null}
          <Typography variant="body2" sx={{ color: "grey.600", mt: 0.5 }}>
            Dobavljač: {supplierDisplay}
          </Typography>
        </div>

        <IconButton aria-label="remove line">
          <Delete sx={{ color: "grey.600", fontSize: 22 }} />
        </IconButton>
      </FlexBetween>
    </Box>
  );
}
