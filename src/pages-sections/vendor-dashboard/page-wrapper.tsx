import { PropsWithChildren } from "react";
import Typography from "@mui/material/Typography";

// ==============================================================
interface Props extends PropsWithChildren {
  title: string;
}
// ==============================================================

export default function PageWrapper({ children, title }: Props) {
  return (
    <div className="pt-2 pb-2">
      <Typography variant="h3" sx={{ mb: 2 }}>
        {title}
      </Typography>

      {children}
    </div>
  );
}
