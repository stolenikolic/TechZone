import type { Metadata } from "next";
import AdminSupplierDetailView from "pages-sections/vendor-dashboard/suppliers/detail-view";

export const metadata: Metadata = {
  title: "Supplier detail - Tech Zone Admin"
};

export default async function AdminSupplierDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminSupplierDetailView supplierId={id} />;
}
