import type { Metadata } from "next";
import AdminSuppliersPageView from "pages-sections/vendor-dashboard/suppliers/page-view";

export const metadata: Metadata = {
  title: "Suppliers - Tech Zone Admin"
};

export default function AdminSuppliersPage() {
  return <AdminSuppliersPageView />;
}
