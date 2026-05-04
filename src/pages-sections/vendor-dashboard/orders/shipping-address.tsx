import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

// ==============================================================
type Props = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  deliveryNotes?: string;
};
// ==============================================================

export default function ShippingAddress({
  customerName,
  customerEmail,
  customerPhone,
  address,
  deliveryNotes
}: Props) {
  return (
    <Card
      sx={(theme) => ({
        px: 3,
        py: 4,
        "& .MuiFormControl-root": { position: "relative" },
        "& .MuiInputLabel-root": { zIndex: 2 },
        "& .MuiInputLabel-root.MuiInputLabel-shrink": {
          zIndex: 3,
          bgcolor: "background.paper",
          px: 0.75,
          ml: "-4px"
        },
        "& .MuiOutlinedInput-root": { zIndex: 0 },
        "& .MuiOutlinedInput-root input:-webkit-autofill": {
          WebkitTextFillColor: theme.palette.text.primary,
          caretColor: theme.palette.text.primary
        }
      })}
    >
      <Typography variant="h6" sx={{ mb: 2 }}>
        Customer &amp; delivery
      </Typography>

      <Stack spacing={2} sx={{ mb: 4 }}>
        <TextField
          fullWidth
          label="Full name"
          variant="outlined"
          color="info"
          value={customerName}
          InputProps={{ readOnly: true }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          fullWidth
          type="email"
          label="Email"
          variant="outlined"
          color="info"
          value={customerEmail}
          InputProps={{ readOnly: true }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          fullWidth
          label="Phone"
          variant="outlined"
          color="info"
          value={customerPhone}
          InputProps={{ readOnly: true }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Stack>

      <TextField
        rows={4}
        multiline
        fullWidth
        color="info"
        variant="outlined"
        label="Shipping address"
        value={address}
        InputProps={{ readOnly: true }}
        sx={{ mb: 4 }}
        slotProps={{ inputLabel: { shrink: true } }}
      />

      <TextField
        rows={5}
        multiline
        fullWidth
        color="info"
        variant="outlined"
        label="Delivery notes"
        value={
          deliveryNotes?.trim()
            ? deliveryNotes
            : "No additional delivery instructions."
        }
        InputProps={{ readOnly: true }}
        slotProps={{ inputLabel: { shrink: true } }}
      />
    </Card>
  );
}
