"use client";

import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { FlexBox } from "components/flex-box";

export type ActiveFilterChip = {
  id: string;
  label: string;
};

interface Props {
  chips: ActiveFilterChip[];
  onRemove: (chip: ActiveFilterChip) => void;
  onClearAll: () => void;
}

export default function ActiveFilterChips({ chips, onRemove, onClearAll }: Props) {
  if (chips.length === 0) return null;

  return (
    <FlexBox alignItems="center" gap={1} flexWrap="wrap" sx={{ mb: 2 }}>
      {chips.map((chip) => (
        <Chip
          key={chip.id}
          size="small"
          color="primary"
          variant="outlined"
          label={chip.label}
          onDelete={() => onRemove(chip)}
        />
      ))}

      <Typography
        component="button"
        type="button"
        variant="body2"
        onClick={onClearAll}
        sx={{
          border: 0,
          p: 0,
          background: "none",
          cursor: "pointer",
          color: "primary.main",
          fontWeight: 600,
          "&:hover": { textDecoration: "underline" }
        }}
      >
        Očisti
      </Typography>
    </FlexBox>
  );
}
