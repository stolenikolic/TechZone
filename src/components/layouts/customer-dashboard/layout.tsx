import type { PropsWithChildren } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Container from "@mui/material/Container";
import CustomerDashboardBreadcrumbs from "components/customer-dashboard/customer-dashboard-breadcrumbs";
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
            <CustomerDashboardBreadcrumbs />
            <Navigation />
          </Grid>

          <Grid size={{ lg: 9, xs: 12 }}>
            <Box sx={{ display: { xs: "block", lg: "none" }, mb: 2 }}>
              <CustomerDashboardBreadcrumbs />
            </Box>
            {children}
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
