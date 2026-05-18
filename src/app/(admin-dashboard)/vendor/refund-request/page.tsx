import { adminPageMetadata } from "lib/site-metadata";
import { RefundRequestPageView } from "pages-sections/vendor-dashboard/refund-request/page-view";
// API FUNCTIONS
import api from "utils/__api__/dashboard";

export const metadata = adminPageMetadata("Zahtjevi za povrat");

export default async function RefundRequest() {
  const requests = await api.refundRequests();
  return <RefundRequestPageView requests={requests} />;
}
