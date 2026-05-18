import { adminPageMetadata } from "lib/site-metadata";
import { SellersPageView } from "pages-sections/vendor-dashboard/sellers/page-view";
// API FUNCTIONS
import api from "utils/__api__/dashboard";

export const metadata = adminPageMetadata("Prodavači");

export default async function Sellers() {
  const sellers = await api.sellers();
  return <SellersPageView sellers={sellers} />;
}
