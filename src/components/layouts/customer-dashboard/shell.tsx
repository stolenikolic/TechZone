import type { PropsWithChildren } from "react";
import { getOrderStatsForUser } from "lib/auth/customer-orders";
import { getAuthUser } from "lib/auth/session";
import { CustomerDashboardLayout } from "./layout";

export async function CustomerDashboardShell({ children }: PropsWithChildren) {
  const user = await getAuthUser();
  const orderCount = user
    ? await getOrderStatsForUser(user.id)
        .then((stats) => stats.total)
        .catch(() => 0)
    : 0;

  return <CustomerDashboardLayout orderCount={orderCount}>{children}</CustomerDashboardLayout>;
}
