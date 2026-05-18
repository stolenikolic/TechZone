import { adminPageMetadata } from "lib/site-metadata";
import AdminSuppliersPageView from "pages-sections/vendor-dashboard/suppliers/page-view";

export const metadata = adminPageMetadata("Dobavljači");

export default function AdminSuppliersPage() {
  return <AdminSuppliersPageView />;
}
