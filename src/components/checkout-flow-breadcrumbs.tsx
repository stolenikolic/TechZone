"use client";

import { usePathname } from "next/navigation";
import SiteBreadcrumbs from "components/site-breadcrumbs/site-breadcrumbs";
import type { SiteBreadcrumbItem } from "components/site-breadcrumbs";

const CRUMBS_BY_PATH: Record<string, SiteBreadcrumbItem[]> = {
  "/korpa": [{ label: "Korpa" }],
  "/narudzba": [{ label: "Korpa", href: "/korpa" }, { label: "Naplata" }],
  "/placanje": [{ label: "Korpa", href: "/korpa" }, { label: "Naplata", href: "/narudzba" }, { label: "Plaćanje" }]
};

/** Iznad steppera na /korpa, /narudzba, /placanje — isti raspored kao dogovoreni koraci. */
export default function CheckoutFlowBreadcrumbs() {
  const pathname = usePathname();
  const key = pathname?.replace(/\/$/, "") ?? "";
  const items = CRUMBS_BY_PATH[key];
  if (!items) return null;

  return <SiteBreadcrumbs items={items} />;
}
