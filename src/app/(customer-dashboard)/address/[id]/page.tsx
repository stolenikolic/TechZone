import { Metadata } from "next";
import { dynamicShopMetadata } from "lib/site-metadata";
import { notFound } from "next/navigation";
import { AddressDetailsPageView } from "pages-sections/customer-dashboard/address/page-view";
// API FUNCTIONS
import api from "utils/__api__/address";
// CUSTOM DATA MODEL
import { IdParams } from "models/Common";

export async function generateMetadata({ params }: IdParams): Promise<Metadata> {
  const { id } = await params;
  const address = await api.getAddress(id);
  if (!address) notFound();

  return dynamicShopMetadata(address.title);
}

export default async function Address({ params }: IdParams) {
  const { id } = await params;
  const address = await api.getAddress(id);

  if (!address) notFound();

  return <AddressDetailsPageView address={address} />;
}
