import type { PropsWithChildren } from "react";
// MUI
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Container from "@mui/material/Container";
// LOCAL CUSTOM COMPONENTS
import { Navigation } from "./navigation";

const gridStyle = {
  display: {
    xs: "none",
    lg: "block"
  }
};

export function CustomerDashboardLayout({ children }: PropsWithChildren) {
  return (
    <Box bgcolor="grey.50" py={{ xs: 3, sm: 4 }}>
      <Container>
        <Grid container spacing={3}>
          <Grid size={{ lg: 3, xs: 12 }} sx={gridStyle}>
            <Navigation />
          </Grid>

          <Grid size={{ lg: 9, xs: 12 }}>{children}</Grid>
        </Grid>
      </Container>
    </Box>
  );
}
