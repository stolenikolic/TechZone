import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
// MUI
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import Clear from "@mui/icons-material/Clear";
// GLOBAL CUSTOM HOOK
import useCart from "hooks/useCart";
// LOCAL CUSTOM COMPONENTS
import MiniCartItem from "./components/cart-item";
import EmptyCartView from "./components/empty-view";
// GLOBAL CUSTOM COMPONENT
import { FlexBetween } from "components/flex-box";
import OverlayScrollbar from "components/overlay-scrollbar";
// CUSTOM UTILS LIBRARY FUNCTION
import { currency } from "lib";
import CartDeliverySummaryBlock from "components/cart/cart-delivery-summary";
import {
  computeCartDeliverySummary,
  getOfferLabelForCartLine
} from "lib/cart/cart-display-meta";
// CUSTOM DATA MODEL
import { CartItem } from "contexts/CartContext";

export default function MiniCart() {
  const router = useRouter();
  const { state, dispatch } = useCart();
  const CART_LENGTH = state.cart.length;
  const deliverySummary = useMemo(() => computeCartDeliverySummary(state.cart), [state.cart]);

  const handleCartAmountChange = (amount: number, product: CartItem) => () => {
    dispatch({
      type: "CHANGE_CART_AMOUNT",
      payload: { ...product, qty: amount }
    });
  };

  const getTotalPrice = () => {
    return state.cart.reduce((acc, item) => acc + item.price * item.qty, 0);
  };

  return (
    <Box sx={{ height: "100vh", width: 380, display: "flex", flexDirection: "column" }}>
      <FlexBetween sx={{ ml: 3, mr: 2, height: 74, flexShrink: 0 }}>
        <Typography variant="h6">Your Cart ({CART_LENGTH})</Typography>

        <IconButton size="small" onClick={router.back}>
          <Clear fontSize="small" />
        </IconButton>
      </FlexBetween>

      <Divider sx={{ flexShrink: 0 }} />

      <Box sx={{ flex: 1, minHeight: 0 }}>
        {CART_LENGTH > 0 ? (
          <OverlayScrollbar>
            {state.cart.map((item) => (
              <MiniCartItem
                item={item}
                key={item.id}
                offerLabel={getOfferLabelForCartLine(item, state.cart)}
                showLineDelivery={deliverySummary.showLineDeliveryById[item.id] ?? false}
                onCart={handleCartAmountChange}
              />
            ))}
          </OverlayScrollbar>
        ) : (
          <EmptyCartView />
        )}
      </Box>

      {CART_LENGTH > 0 && (
        <Box sx={{ p: 2.5, flexShrink: 0, borderTop: 1, borderColor: "divider" }}>
          <CartDeliverySummaryBlock summary={deliverySummary} compact />
          <FlexBetween sx={{ mb: 2 }}>
            <Typography variant="body1" color="text.secondary">
              Total
            </Typography>
            <Typography variant="h6">{currency(getTotalPrice())}</Typography>
          </FlexBetween>

          <Button
            fullWidth
            color="primary"
            variant="contained"
            LinkComponent={Link}
            href="/checkout"
            sx={{ height: 44, mb: 1 }}
          >
            Proceed to Checkout
          </Button>

          <Button
            fullWidth
            color="primary"
            variant="outlined"
            LinkComponent={Link}
            href="/cart"
            sx={{ height: 44 }}
          >
            View Cart
          </Button>
        </Box>
      )}
      <Snackbar
        open={Boolean(state.warning)}
        autoHideDuration={7000}
        onClose={() => dispatch({ type: "CLEAR_CART_WARNING" })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => dispatch({ type: "CLEAR_CART_WARNING" })}
          severity="warning"
          variant="filled"
          sx={{ width: "100%" }}
        >
          {state.warning}
        </Alert>
      </Snackbar>
    </Box>
  );
}
