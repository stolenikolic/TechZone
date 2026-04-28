import Typography from "@mui/material/Typography";
import Add from "@mui/icons-material/Add";
import Remove from "@mui/icons-material/Remove";
import { QuantityButton } from "./styles";

// =========================================================
type Props = {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  min?: number;
  max?: number;
};
// =========================================================

/**
 * Shared quantity control: [ − ] value [ + ].
 * Used by cart item and product page for identical UI.
 */
export default function QuantityButtons({
  value,
  onIncrement,
  onDecrement,
  min = 1,
  max = 10
}: Props) {
  return (
    <div
      className="quantity-buttons-wrapper"
      style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
    >
      <QuantityButton disabled={value <= min} onClick={onDecrement}>
        <Remove fontSize="small" />
      </QuantityButton>
      <Typography variant="h6">{value}</Typography>
      <QuantityButton disabled={value >= max} onClick={onIncrement}>
        <Add fontSize="small" />
      </QuantityButton>
    </div>
  );
}
