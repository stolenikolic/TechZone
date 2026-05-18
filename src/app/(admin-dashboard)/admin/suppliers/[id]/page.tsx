import { adminPageMetadata } from "lib/site-metadata";
import AdminSupplierDetailView from "pages-sections/vendor-dashboard/suppliers/detail-view";

export const metadata = adminPageMetadata("Detalji dobavljača");

export default async function AdminSupplierDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminSupplierDetailView supplierId={id} />;
}
