import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

export const CardRoot = styled(Card)(({ theme }) => ({
  padding: "1.5rem",
  marginBottom: "2rem",
  backgroundColor: theme.palette.grey[50],
  border: `1px solid ${theme.palette.divider}`,
  // Label iznad Chrome autofill sloja i “notch” obruba (OutlinedInput).
  "& .MuiFormControl-root": {
    position: "relative"
  },
  "& .MuiInputLabel-root": {
    zIndex: 2
  },
  "& .MuiInputLabel-root.MuiInputLabel-shrink": {
    zIndex: 3,
    backgroundColor: theme.palette.grey[50],
    paddingLeft: "6px",
    paddingRight: "6px",
    marginLeft: "-4px"
  },
  "& .MuiOutlinedInput-root": {
    zIndex: 0
  },
  // Podrazumijevani plavi autofill browsera — samo boja teksta da ostane čitljiva na plavoj pozadini.
  "& .MuiOutlinedInput-root input:-webkit-autofill": {
    WebkitTextFillColor: theme.palette.text.primary,
    caretColor: theme.palette.text.primary
  },
  "& .MuiOutlinedInput-root.Mui-focused input:-webkit-autofill": {
    WebkitTextFillColor: theme.palette.text.primary
  }
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
