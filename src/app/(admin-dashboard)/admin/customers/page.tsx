import { adminPageMetadata } from "lib/site-metadata";
import { CustomersPageView } from "pages-sections/vendor-dashboard/customers/page-view";
// API FUNCTIONS
import api from "utils/__api__/dashboard";

export const metadata = adminPageMetadata("Kupci");

export default async function Customers() {
  const customers = await api.customers();
  return <CustomersPageView customers={customers} />;
}
