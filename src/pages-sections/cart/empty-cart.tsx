import Link from "next/link";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { styled } from "@mui/material/styles";
import Trash from "icons/Trash";

const EmptyCartWrapper = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexDirection: "column",
  justifyContent: "center",
  minHeight: 400,
  textAlign: "center",
  padding: "2rem"
}));

const IconWrapper = styled("div")(({ theme }) => ({
  width: 90,
  height: 90,
  borderRadius: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "1.5rem",
  backgroundColor: theme.palette.grey[100],
  color: theme.palette.grey[400],
  fontSize: 48
}));

export default function EmptyCart() {
  return (
    <EmptyCartWrapper>
      <IconWrapper>
        <Trash color="inherit" fontSize="inherit" />
      </IconWrapper>

      <Typography variant="body1" fontSize={24} fontWeight={600}>
        Your cart is empty
      </Typography>

      <Typography variant="body1" fontSize={16} color="text.secondary" sx={{ mb: 3 }}>
        Looks like you haven't added anything to your cart yet.
      </Typography>

      <Button variant="contained" color="primary" href="/products" LinkComponent={Link}>
        Start Shopping
      </Button>
    </EmptyCartWrapper>
  );
}
