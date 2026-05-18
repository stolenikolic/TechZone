import { adminPageMetadata } from "lib/site-metadata";
import { notFound } from "next/navigation";
import { CreateMasterFromOfferPageView } from "pages-sections/vendor-dashboard/products/page-view";
import type { SupplierOfferCreateMasterData } from "app/api/admin/supplier-products/[id]/route";
import { getServerBaseUrl } from "utils/site-url";

export const metadata = adminPageMetadata("Kreiraj proizvod iz ponude");

type Props = {
  params: Promise<{ offerId: string }>;
};

async function getOfferData(offerId: string): Promise<SupplierOfferCreateMasterData | null> {
  const response = await fetch(`${getServerBaseUrl()}/api/admin/supplier-products/${offerId}`, {
    cache: "no-store"
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("Failed to load supplier offer.");
  }

  return response.json();
}

export default async function CreateFromOfferPage({ params }: Props) {
  const { offerId } = await params;
  const data = await getOfferData(offerId);

  if (!data) notFound();

  return <CreateMasterFromOfferPageView {...data} />;
}
