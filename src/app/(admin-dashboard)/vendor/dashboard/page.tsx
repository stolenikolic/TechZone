import { adminPageMetadata } from "lib/site-metadata";
import { DashboardPageView } from "pages-sections/vendor-dashboard/dashboard/page-view";

export const metadata = adminPageMetadata("Kontrolna tabla");

export default function VendorDashboard() {
  return <DashboardPageView />;
}
