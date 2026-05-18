import { adminPageMetadata } from "lib/site-metadata";
import AdminJobsPageView from "pages-sections/vendor-dashboard/jobs/page-view";

export const metadata = adminPageMetadata("Pozadinski poslovi");

export default function AdminJobsPage() {
  return <AdminJobsPageView />;
}
