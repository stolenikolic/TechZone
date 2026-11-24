"use client";

import { usePathname } from "next/navigation";
import SiteBreadcrumbs from "components/site-breadcrumbs/site-breadcrumbs";
import type { SiteBreadcrumbItem } from "components/site-breadcrumbs";

function itemsFor(pathname: string): SiteBreadcrumbItem[] {
  const p = pathname.replace(/\/$/, "") || "/";

  if (p === "/profil") return [{ label: "Profil" }];
  if (p.startsWith("/profil/")) return [{ label: "Profil", href: "/profil" }, { label: "Detalji" }];

  if (p === "/narudzbe") return [{ label: "Narudžbe" }];
  if (p.startsWith("/narudzbe/")) return [{ label: "Narudžbe", href: "/narudzbe" }, { label: "Detalji narudžbe" }];

  if (p === "/address") return [{ label: "Adrese" }];
  if (p.startsWith("/address/")) return [{ label: "Adrese", href: "/address" }, { label: "Adresa" }];

  if (p === "/payment-methods") return [{ label: "Načini plaćanja" }];
  if (p.startsWith("/payment-methods/")) {
    return [{ label: "Načini plaćanja", href: "/payment-methods" }, { label: "Detalji" }];
  }

  if (p === "/lista-zelja") return [{ label: "Lista želja" }];

  if (p === "/support-tickets") return [{ label: "Tiketi podrške" }];
  if (p.startsWith("/support-tickets/")) {
    return [{ label: "Tiketi podrške", href: "/support-tickets" }, { label: "Tiket" }];
  }

  return [];
}

export default function CustomerDashboardBreadcrumbs() {
  const pathname = usePathname() ?? "";
  const items = itemsFor(pathname);
  if (!items.length) return null;
  return <SiteBreadcrumbs items={items} />;
}
