import type { ReactNode } from "react";
import type { SxProps, Theme } from "@mui/material/styles";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { FlexBox } from "components/flex-box";

type Props = {
  title: ReactNode;
  loading?: boolean;
  variant?: "h6" | "body1";
  sx?: SxProps<Theme>;
};

export default function FilterSectionTitle({ title, loading = false, variant = "h6", sx }: Props) {
  return (
    <FlexBox alignItems="center" gap={1} sx={{ minWidth: 0, flex: 1, pr: 1.5, ...sx }}>
      <Typography variant={variant} component="span" sx={{ flex: 1, minWidth: 0 }}>
        {title}
      </Typography>
      {loading ? (
        <CircularProgress
          size={16}
          color="primary"
          sx={{ flexShrink: 0, mr: 0.5 }}
          aria-label="Učitavanje filtera"
        />
      ) : null}
    </FlexBox>
  );
}
