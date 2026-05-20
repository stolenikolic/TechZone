"use client";

import { usePathname } from "next/navigation";
import SiteBreadcrumbs from "components/site-breadcrumbs/site-breadcrumbs";
import type { SiteBreadcrumbItem } from "components/site-breadcrumbs";

const CRUMBS_BY_PATH: Record<string, SiteBreadcrumbItem[]> = {
  "/cart": [{ label: "Korpa" }],
  "/checkout": [{ label: "Korpa", href: "/cart" }, { label: "Naplata" }],
  "/payment": [{ label: "Korpa", href: "/cart" }, { label: "Naplata", href: "/checkout" }, { label: "Plaćanje" }]
};

/** Iznad steppera na /cart, /checkout, /payment — isti raspored kao dogovoreni koraci. */
export default function CheckoutFlowBreadcrumbs() {
  const pathname = usePathname();
  const key = pathname?.replace(/\/$/, "") ?? "";
  const items = CRUMBS_BY_PATH[key];
  if (!items) return null;

  return <SiteBreadcrumbs items={items} />;
}
