"use client";

import type { PropsWithChildren } from "react";
import CustomerDashboardBreadcrumbs from "./customer-dashboard-breadcrumbs";

/** Zajednički omotač za korisničke stranice: breadcrumbs + sadržaj (Shop layout). */
export default function CustomerDashboardChrome({ children }: PropsWithChildren) {
  return (
    <>
      <CustomerDashboardBreadcrumbs />
      {children}
    </>
  );
}
