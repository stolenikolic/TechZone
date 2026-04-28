import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import { format } from "date-fns/format";
// GLOBAL CUSTOM COMPONENTS
import FlexBox from "components/flex-box/flex-box";

// ==============================================================
interface Props {
  id: string;
  status: string;
  createdAt: Date;
}
// ==============================================================

export default function OrderActions({ id, createdAt, status }: Props) {
  return (
    <div>
      <FlexBox flexWrap="wrap" alignItems="center" columnGap={4} rowGap={1}>
        <Typography variant="body1" sx={{ span: { color: "grey.600" } }}>
          <span>Order ID:</span> {id}
        </Typography>

        <Typography variant="body1" sx={{ span: { color: "grey.600" } }}>
          <span>Placed on:</span> {format(new Date(createdAt), "dd MMM, yyyy")}
        </Typography>
      </FlexBox>

      <FlexBox gap={3} my={3} flexDirection={{ sm: "row", xs: "column" }}>
        <TextField
          fullWidth
          color="info"
          size="medium"
          variant="outlined"
          label="Add Product"
          placeholder="Type product name"
        />

        <TextField
          select
          fullWidth
          color="info"
          size="medium"
          defaultValue={status}
          label="Order Status"
          slotProps={{
            select: {
              IconComponent: () => <KeyboardArrowDown sx={{ color: "grey.600", mr: 1 }} />
            }
          }}
        >
          <MenuItem value="Processing">Processing</MenuItem>
          <MenuItem value="Pending">Pending</MenuItem>
          <MenuItem value="Delivered">Delivered</MenuItem>
          <MenuItem value="Cancelled">Cancelled</MenuItem>
        </TextField>
      </FlexBox>
    </div>
  );
}
