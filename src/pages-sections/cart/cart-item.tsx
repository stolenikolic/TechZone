import Link from "next/link";
import Image from "next/image";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Trash from "icons/Trash";
import useCart from "hooks/useCart";
import { formatPrice } from "lib";
import CartLineMeta from "components/cart/cart-line-meta";
import QuantityButtons from "./quantity-buttons";
import { ContentWrapper, ImageWrapper, Wrapper } from "./styles";
import { CartItem as CartModel } from "contexts/CartContext";

// =========================================================
type Props = {
  item: CartModel;
  offerLabel: string | null;
  showLineDelivery: boolean;
};
// =========================================================

export default function CartItem({ item, offerLabel, showLineDelivery }: Props) {
  const { id, title, price, thumbnail, slug, qty } = item;

  const { dispatch } = useCart();

  const handleCartAmountChange = (amount: number) => () => {
    dispatch({
      type: "CHANGE_CART_AMOUNT",
      payload: { ...item, qty: amount }
    });
  };

  return (
    <Wrapper elevation={0}>
      <ImageWrapper>
        <Image alt={title} fill src={thumbnail} sizes="100px" />
      </ImageWrapper>

      <ContentWrapper>
        <Stack spacing={0.5} overflow="hidden">
          <Link href={`/products/${slug}`}>
            <Typography noWrap variant="body1" fontSize={16}>
              {title}
            </Typography>
          </Link>

          <CartLineMeta item={item} offerLabel={offerLabel} showLineDelivery={showLineDelivery} />

          <Typography noWrap variant="body1" fontWeight={600}>
            {formatPrice(price)}
          </Typography>
        </Stack>

        <QuantityButtons
          value={qty}
          min={1}
          max={10}
          onDecrement={handleCartAmountChange(qty - 1)}
          onIncrement={handleCartAmountChange(qty + 1)}
        />

        <Typography noWrap variant="body1" fontSize={16} fontWeight={600}>
          {formatPrice(price * qty)}
        </Typography>

        <IconButton className="remove-item" size="small" onClick={handleCartAmountChange(0)}>
          <Trash fontSize="small" color="error" />
        </IconButton>
      </ContentWrapper>
    </Wrapper>
  );
}
