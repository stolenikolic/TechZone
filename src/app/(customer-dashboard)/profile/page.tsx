import { Metadata } from "next";
import { dynamicShopMetadata } from "lib/site-metadata";
import { ProfilePageView } from "pages-sections/customer-dashboard/profile/page-view";
import { getSessionProfile } from "lib/auth/session";
import { profileToUserModel } from "lib/auth/map-user";

export async function generateMetadata(): Promise<Metadata> {
  const profile = await getSessionProfile();
  const name = profile?.full_name?.trim() || "Profil";
  return dynamicShopMetadata(name);
}

export default async function Profile() {
  const profile = await getSessionProfile();
  if (!profile) return null;

  const user = profileToUserModel(profile);

  return <ProfilePageView user={user} />;
}
