import DeliveryRangeText from "components/delivery/delivery-range-text";
import type { CartItem } from "contexts/CartContext";
import Typography from "@mui/material/Typography";
import { getLineDeliveryBand } from "lib/cart/cart-display-meta";

type Props = {
  item: CartItem;
  offerLabel: string | null;
  showLineDelivery: boolean;
};

export default function CartLineMeta({ item, offerLabel, showLineDelivery }: Props) {
  const lineBand = showLineDelivery ? getLineDeliveryBand(item) : null;

  if (!offerLabel && !lineBand) return null;

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
      {lineBand ? (
        <DeliveryRangeText
          tone={lineBand.tone}
          rangeLabel={lineBand.rangeLabel}
          lead="Isporuka za"
          fontSize={12}
          noWrap
        />
      ) : null}
    </>
  );
}
