import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfilePageView } from "pages-sections/customer-dashboard/profile/page-view";
// API FUNCTIONS
import api from "utils/__api__/users";

export async function generateMetadata(): Promise<Metadata> {
  const user = await api.getUser();
  if (!user) notFound();

  const name = `${user.name.firstName} ${user.name.lastName}`;

  return {
    title: name + " - Bazaar Next.js E-commerce Template",
    description: "Bazaar is a React Next.js E-commerce template.",
    authors: [{ name: "UI-LIB", url: "https://ui-lib.com" }],
    keywords: ["e-commerce", "e-commerce template", "next.js", "react"]
  };
}

export default async function Profile() {
  const user = await api.getUser();

  if (!user) notFound();

  return <ProfilePageView user={user} />;
}
