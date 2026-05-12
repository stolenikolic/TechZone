import type { Metadata } from "next";
import AdminJobsPageView from "pages-sections/vendor-dashboard/jobs/page-view";

export const metadata: Metadata = {
  title: "Background Jobs - Tech Zone Admin"
};

export default function AdminJobsPage() {
  return <AdminJobsPageView />;
}
