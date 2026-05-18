import { adminPageMetadata } from "lib/site-metadata";
import { SellerPackagePageView } from "pages-sections/vendor-dashboard/seller-package/page-view";

export const metadata = adminPageMetadata("Paket prodavača");

export default async function SellerPackage() {
  return <SellerPackagePageView />;
}
