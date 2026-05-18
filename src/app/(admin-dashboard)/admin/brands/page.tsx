import { adminPageMetadata } from "lib/site-metadata";
import { BrandsPageView } from "pages-sections/vendor-dashboard/brands/page-view";
// API FUNCTIONS
import api from "utils/__api__/dashboard";

export const metadata = adminPageMetadata("Brendovi");

export default async function Brands() {
  const brands = await api.brands();
  return <BrandsPageView brands={brands} />;
}
