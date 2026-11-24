import Link from "next/link";
// MUI
import Card from "@mui/material/Card";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM HOOK
import useCart from "hooks/useCart";
// GLOBAL CUSTOM COMPONENTS
import { FlexBetween, FlexBox } from "components/flex-box";
// DUMMY CUSTOM DATA
import countryList from "data/countryList";
// CUSTOM UTILS LIBRARY FUNCTION
import { currency } from "lib";
import CartDeliverySummaryBlock from "components/cart/cart-delivery-summary";
import type { CartDeliverySummary } from "lib/cart/cart-display-meta";

const STATE_LIST = [
  { value: "new-york", label: "New York" },
  { value: "chicago", label: "Chicago" }
];

type Props = {
  deliverySummary: CartDeliverySummary;
};

export default function CheckoutForm({ deliverySummary }: Props) {
  const { state } = useCart();

  const getTotalPrice = () => state.cart.reduce((acc, item) => acc + item.price * item.qty, 0);

  return (
    <Card
      elevation={0}
      sx={{
        padding: 3,
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: "grey.50"
      }}
    >
      <CartDeliverySummaryBlock summary={deliverySummary} />

      <FlexBetween mb={2}>
        <Typography variant="body1" fontSize={16} fontWeight={600}>
          Ukupno:
        </Typography>

        <Typography variant="body1" fontSize={18} fontWeight={600} lineHeight={1}>
          {currency(getTotalPrice())}
        </Typography>
      </FlexBetween>

      <Divider sx={{ mb: 2 }} />

      <FlexBox alignItems="center" columnGap={1} mb={2}>
        <Typography variant="body1" fontWeight={500}>
          Dodatni komentar
        </Typography>

        <Typography
          variant="body1"
          sx={{
            fontSize: 12,
            lineHeight: 1,
            padding: "2px 6px",
            borderRadius: "3px",
            bgcolor: "grey.200"
          }}
        >
          Napomena
        </Typography>
      </FlexBox>

      {/* COMMENTS TEXT FIELD */}
      <TextField variant="outlined" rows={3} fullWidth multiline />

      {/* APPLY VOUCHER TEXT FIELD */}
      <FlexBox alignItems="center" gap={1} my={2}>
        <TextField
          fullWidth
          size="small"
          label="Vaučer"
          variant="outlined"
          placeholder="Vaučer"
        />

        <Button variant="outlined" color="primary">
          Primijeni
        </Button>
      </FlexBox>

      <Divider sx={{ mb: 2 }} />

      <Typography variant="body1" fontWeight={500} sx={{ mb: 2 }}>
        Procjena dostave
      </Typography>

      {/* COUNTRY TEXT FIELD */}
      <Autocomplete
        fullWidth
        sx={{ mb: 2 }}
        options={countryList}
        openText="Otvori"
        closeText="Zatvori"
        clearText="Obriši"
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            label="Država"
            variant="outlined"
            placeholder="Izaberi državu"
          />
        )}
      />

      {/* STATE/CITY TEXT FIELD */}
      <TextField
        select
        fullWidth
        size="small"
        label="Regija"
        variant="outlined"
        placeholder="Izaberi regiju"
        defaultValue="new-york"
      >
        {STATE_LIST.map(({ label, value }) => (
          <MenuItem value={value} key={label}>
            {label}
          </MenuItem>
        ))}
      </TextField>

      {/* ZIP-CODE TEXT FIELD */}
      <TextField
        fullWidth
        size="small"
        label="Poštanski broj"
        placeholder="3100"
        variant="outlined"
        sx={{ mt: 2 }}
      />

      <Button variant="outlined" color="primary" fullWidth sx={{ my: 2 }}>
        Izračunaj dostavu
      </Button>

      <Button fullWidth color="primary" href="/narudzba" variant="contained" LinkComponent={Link}>
        Nastavi na narudžbu
      </Button>
      <Snackbar
        open={Boolean(state.warning)}
        autoHideDuration={7000}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity="warning" variant="filled" sx={{ width: "100%" }}>
          {state.warning}
        </Alert>
      </Snackbar>
    </Card>
  );
}
