import { adminPageMetadata } from "lib/site-metadata";
import { VendorEarningHistoryPageView } from "pages-sections/vendor-dashboard/v-earning-history/page-view";
// API FUNCTIONS
import api from "utils/__api__/dashboard";

export const metadata = adminPageMetadata("Historija zarade");

export default async function EarningHistory() {
  const earnings = await api.earningHistory();
  return <VendorEarningHistoryPageView earnings={earnings} />;
}
