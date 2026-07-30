import type { PropsWithChildren } from "react";
import ShopLayout1 from "components/layouts/shop-layout-1";
// API FUNCTIONS
import api from "utils/__api__/layout";

// Category menu data has no per-user personalization, so it is safe to cache
// as ISR instead of forcing a full dynamic render on every request.
export const revalidate = 60;

export default async function ShopLayout({ children }: PropsWithChildren) {
  const data = await api.getLayoutData();
  return <ShopLayout1 data={data}>{children}</ShopLayout1>;
}
