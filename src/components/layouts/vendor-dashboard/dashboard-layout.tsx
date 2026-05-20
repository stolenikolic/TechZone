"use client";

import { PropsWithChildren } from "react";
import Container from "@mui/material/Container";
import DashboardBreadcrumbs from "components/dashboard-breadcrumbs";
// LOCAL CUSTOM COMPONENTS
import BodyWrapper from "./dashboard-body-wrapper";
import DashboardNavbar from "./dashboard-navbar/dashboard-navbar";
import DashboardSidebar from "./dashboard-sidebar/dashboard-sidebar";
// LOCAL LAYOUT CONTEXT PROVIDER
import { LayoutProvider } from "./dashboard-layout-context";

export default function VendorDashboardLayout({ children }: PropsWithChildren) {
  return (
    <LayoutProvider>
      {/* DASHBOARD SIDEBAR NAVIGATION */}
      <DashboardSidebar />

      <BodyWrapper>
        {/* DASHBOARD HEADER / TOP BAR AREA */}
        <DashboardNavbar />

        {/* MAIN CONTENT AREA */}
        <Container maxWidth={false} sx={{ px: { xs: 2, md: 3 } }}>
          <DashboardBreadcrumbs />
          {children}
        </Container>
      </BodyWrapper>
    </LayoutProvider>
  );
}
