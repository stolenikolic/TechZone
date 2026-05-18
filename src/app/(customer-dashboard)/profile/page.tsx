import { Metadata } from "next";
import { dynamicShopMetadata } from "lib/site-metadata";
import { notFound } from "next/navigation";
import { ProfilePageView } from "pages-sections/customer-dashboard/profile/page-view";
// API FUNCTIONS
import api from "utils/__api__/users";

export async function generateMetadata(): Promise<Metadata> {
  const user = await api.getUser();
  if (!user) notFound();

  const name = `${user.name.firstName} ${user.name.lastName}`;

  return dynamicShopMetadata(name);
}

export default async function Profile() {
  const user = await api.getUser();

  if (!user) notFound();

  return <ProfilePageView user={user} />;
}
