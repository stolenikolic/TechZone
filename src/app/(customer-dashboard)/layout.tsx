import type { PropsWithChildren } from "react";
import CustomerDashboardChrome from "components/customer-dashboard/customer-dashboard-chrome";
import ShopLayout1 from "components/layouts/shop-layout-1";
// API FUNCTIONS
import api from "utils/__api__/layout";

export const dynamic = "force-dynamic";

export default async function Layout1({ children }: PropsWithChildren) {
  const data = await api.getLayoutData();

  if (!data) return <>{children}</>;

  return (
    <ShopLayout1 data={data}>
      <CustomerDashboardChrome>{children}</CustomerDashboardChrome>
    </ShopLayout1>
  );
}
