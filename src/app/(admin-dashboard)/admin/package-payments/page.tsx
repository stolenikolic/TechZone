import { adminPageMetadata } from "lib/site-metadata";
import { PackagePaymentPageView } from "pages-sections/vendor-dashboard/package-payments/page-view";
// API FUNCTIONS
import api from "utils/__api__/dashboard";

export const metadata = adminPageMetadata("Plaćanja paketa");

export default async function PackagePayments() {
  const payments = await api.packagePayments();
  return <PackagePaymentPageView payments={payments} />;
}
