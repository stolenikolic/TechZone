import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { FlexBetween } from "components/flex-box";
import CheckboxLabel from "./checkbox-label";

const SPINNER_SLOT_PX = 12;

type Props = {
  label: string;
  checked: boolean;
  onChange: () => void;
  pending?: boolean;
};

/** Checkbox lijevo, spinner uz desnu marginu reda (npr. LGA 1200). */
export default function FilterCheckboxRow({ label, checked, onChange, pending = false }: Props) {
  return (
    <FlexBetween alignItems="center" sx={{ width: "100%", minHeight: 32, pr: 0.5 }}>
      <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
        <CheckboxLabel label={label} checked={checked} onChange={onChange} />
      </Box>
      <Box
        sx={{
          width: SPINNER_SLOT_PX,
          flexShrink: 0,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center"
        }}
        aria-hidden={!pending}
      >
        {pending ? (
          <CircularProgress size={SPINNER_SLOT_PX} color="primary" aria-label="Učitavanje" />
        ) : null}
      </Box>
    </FlexBetween>
  );
}
