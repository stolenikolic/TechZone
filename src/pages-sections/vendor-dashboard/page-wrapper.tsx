import { PropsWithChildren, ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

// ==============================================================
interface Props extends PropsWithChildren {
  title: string;
  /** Right-aligned actions on the same row as the title (optional). */
  actions?: ReactNode;
}
// ==============================================================

export default function PageWrapper({ children, title, actions }: Props) {
  return (
    <div className="pt-2 pb-2">
      <Box
        sx={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 2,
          mb: 2,
          flexWrap: "wrap"
        }}
      >
        <Typography variant="h3" sx={{ flex: "1 1 auto", minWidth: 0 }}>
          {title}
        </Typography>
        {actions ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0, ml: "auto" }}>
            {actions}
          </Box>
        ) : null}
      </Box>

      {children}
    </div>
  );
}
