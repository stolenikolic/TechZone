import Link from "next/link";
import { useRouter } from "next/navigation";
// MUI
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
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
// CUSTOM DATA MODEL
import { CartItem } from "contexts/CartContext";

export default function MiniCart() {
  const router = useRouter();
  const { state, dispatch } = useCart();
  const CART_LENGTH = state.cart.length;

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
    <Box height="100vh" width={380}>
      <FlexBetween ml={3} mr={2} height={74}>
        <Typography variant="h6">Your Cart ({CART_LENGTH})</Typography>

        <IconButton size="small" onClick={router.back}>
          <Clear fontSize="small" />
        </IconButton>
      </FlexBetween>

      <Divider />

      <Box height={`calc(100% - ${CART_LENGTH ? "211px" : "75px"})`}>
        {CART_LENGTH > 0 ? (
          <OverlayScrollbar>
            {state.cart.map((item) => (
              <MiniCartItem item={item} key={item.id} onCart={handleCartAmountChange} />
            ))}
          </OverlayScrollbar>
        ) : (
          <EmptyCartView />
        )}
      </Box>

      {CART_LENGTH > 0 && (
        <Box p={2.5}>
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
    </Box>
  );
}
