"use client";

import NextTopLoader from "nextjs-toploader";
import { useTheme } from "@mui/material/styles";

export default function ProgressBar() {
  const theme = useTheme();

  return (
    <NextTopLoader
      height={3}
      shadow={false}
      showSpinner={true}
      color={theme.palette.primary.main}
    />
  );
}
