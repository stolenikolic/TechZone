import { Metadata } from "next";
import { dynamicShopMetadata } from "lib/site-metadata";
import { notFound, redirect } from "next/navigation";
import { ProfileEditPageView } from "pages-sections/customer-dashboard/profile/page-view";
import { getSessionProfile } from "lib/auth/session";
import { profileToUserModel } from "lib/auth/map-user";

export async function generateMetadata(): Promise<Metadata> {
  const profile = await getSessionProfile();
  if (!profile) notFound();
  const name = profile.full_name?.trim() || "Profil";
  return dynamicShopMetadata(name);
}

type Props = { params: Promise<{ id: string }> };

export default async function ProfileEdit({ params }: Props) {
  const { id } = await params;
  const profile = await getSessionProfile();
  if (!profile) return null;
  if (profile.id !== id) redirect("/profile");

  const user = profileToUserModel(profile);
  return <ProfileEditPageView user={user} />;
}
