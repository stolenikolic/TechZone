import { adminPageMetadata } from "lib/site-metadata";
import { PayoutRequestsPageView } from "pages-sections/vendor-dashboard/payout-requests/page-view";
// API FUNCTIONS
import api from "utils/__api__/dashboard";

export const metadata = adminPageMetadata("Zahtjevi za isplatu");

export default async function PayoutRequests() {
  const requests = await api.payoutRequests();
  return <PayoutRequestsPageView requests={requests} />;
}
