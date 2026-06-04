import Typography from "@mui/material/Typography";
import type { CartItem } from "contexts/CartContext";
import { getLineDeliveryDisplayText } from "lib/cart/cart-display-meta";

type Props = {
  item: CartItem;
  offerLabel: string | null;
  showLineDelivery: boolean;
};

export default function CartLineMeta({ item, offerLabel, showLineDelivery }: Props) {
  const lineDelivery = showLineDelivery ? getLineDeliveryDisplayText(item) : null;

  if (!offerLabel && !lineDelivery) return null;

  return (
    <>
      {offerLabel ? (
        <Typography
          variant="body2"
          color="primary.main"
          fontWeight={600}
          sx={{ fontSize: 13 }}
          noWrap
        >
          {offerLabel}
        </Typography>
      ) : null}
      {lineDelivery ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }} noWrap>
          {lineDelivery}
        </Typography>
      ) : null}
    </>
  );
}
