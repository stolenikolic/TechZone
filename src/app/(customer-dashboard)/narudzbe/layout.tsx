import { PropsWithChildren } from "react";
import { CustomerDashboardShell } from "components/layouts/customer-dashboard/shell";

export default function Layout({ children }: PropsWithChildren) {
  return <CustomerDashboardShell>{children}</CustomerDashboardShell>;
}
