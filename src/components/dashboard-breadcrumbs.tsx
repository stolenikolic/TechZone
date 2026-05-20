"use client";

import { usePathname } from "next/navigation";
import SiteBreadcrumbs from "components/site-breadcrumbs/site-breadcrumbs";
import { getDashboardBreadcrumbItems } from "lib/dashboard-breadcrumb-items";

/** Početna → Admin / Panel + podstranica (unutar dashboard layout-a). */
export default function DashboardBreadcrumbs() {
  const pathname = usePathname() ?? "";
  const items = getDashboardBreadcrumbItems(pathname);
  if (!items.length) return null;
  return <SiteBreadcrumbs items={items} />;
}
