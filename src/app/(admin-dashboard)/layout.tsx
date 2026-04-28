import { PropsWithChildren } from "react";
import VendorDashboardLayout from "components/layouts/vendor-dashboard";

/** Avoid SSG-time axios calls to missing /api/* during `next build`. */
export const dynamic = "force-dynamic";

export default function Layout({ children }: PropsWithChildren) {
  return <VendorDashboardLayout>{children}</VendorDashboardLayout>;
}
