import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

export const CardRoot = styled(Card)(({ theme }) => ({
  padding: "1.5rem",
  marginBottom: "2rem",
  backgroundColor: theme.palette.grey[50],
  border: `1px solid ${theme.palette.divider}`
}));

export const FormWrapper = styled("div")(({ theme }) => ({
  gap: 16,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  [theme.breakpoints.down("sm")]: { gridTemplateColumns: "1fr" }
}));

export const ButtonWrapper = styled("div")(({ theme }) => ({
  gap: 16,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  [theme.breakpoints.down("sm")]: { gridTemplateColumns: "1fr" }
}));
