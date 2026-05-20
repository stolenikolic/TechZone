import type { SiteBreadcrumbItem } from "components/site-breadcrumbs";

const ADMIN_HUB = { label: "Admin", href: "/admin/products" } as const;
const VENDOR_HUB = { label: "Panel", href: "/vendor/dashboard" } as const;

/** Tačna admin ruta → prikaz (ijekavica). */
const ADMIN_EXACT: Record<string, string> = {
  "/admin/products": "Lista proizvoda",
  "/admin/products/supplier-offers": "Ponude dobavljača",
  "/admin/products/create": "Novi proizvod",
  "/admin/products/reviews": "Recenzije proizvoda",
  "/admin/pricing": "Cjenovnici",
  "/admin/jobs": "Poslovi",
  "/admin/suppliers": "Dobavljači",
  "/admin/categories": "Lista kategorija",
  "/admin/categories/create": "Nova kategorija",
  "/admin/homepage": "Početna stranica",
  "/admin/brands": "Lista brendova",
  "/admin/brands/create": "Novi brend",
  "/admin/customers": "Kupci",
  "/admin/orders": "Lista narudžbi",
  "/admin/package-payments": "Plaćanja paketa",
  "/admin/payout-requests": "Zahtjevi za isplatu",
  "/admin/payouts": "Isplate",
  "/admin/refund-request": "Zahtjevi za povrat",
  "/admin/refund-setting": "Postavke povrata",
  "/admin/sellers": "Prodavci",
  "/admin/seller-package": "Paketi prodavaca",
  "/admin/earning-history": "Historija zarade"
};

const VENDOR_EXACT: Record<string, string> = {
  "/vendor/dashboard": "Kontrolna tabla",
  "/vendor/earning-history": "Historija zarade",
  "/vendor/payouts": "Isplate",
  "/vendor/payout-requests": "Zahtjevi za isplatu",
  "/vendor/payout-settings": "Postavke isplate",
  "/vendor/refund-request": "Zahtjevi za povrat",
  "/vendor/reviews": "Recenzije",
  "/vendor/shop-settings": "Postavke prodavnice",
  "/vendor/support-tickets": "Tiketi podrške",
  "/vendor/account-settings": "Postavke naloga",
  "/vendor/site-settings": "Postavke sajta"
};

function adminDynamic(p: string): SiteBreadcrumbItem[] | null {
  if (p.startsWith("/admin/products/create-from-offer/")) {
    return [ADMIN_HUB, { label: "Lista proizvoda", href: "/admin/products" }, { label: "Iz ponude" }];
  }
  if (p.startsWith("/admin/products/") && !ADMIN_EXACT[p]) {
    const rest = p.slice("/admin/products/".length);
    if (!rest || ADMIN_EXACT[`/admin/products/${rest.split("/")[0]}`]) return null;
    return [ADMIN_HUB, { label: "Lista proizvoda", href: "/admin/products" }, { label: decodeSlugTail(rest) }];
  }
  if (p.startsWith("/admin/categories/") && p !== "/admin/categories/create") {
    const rest = p.slice("/admin/categories/".length);
    return [ADMIN_HUB, { label: "Lista kategorija", href: "/admin/categories" }, { label: decodeSlugTail(rest) }];
  }
  if (p.startsWith("/admin/brands/") && p !== "/admin/brands/create") {
    const rest = p.slice("/admin/brands/".length);
    return [ADMIN_HUB, { label: "Lista brendova", href: "/admin/brands" }, { label: decodeSlugTail(rest) }];
  }
  if (p.startsWith("/admin/orders/")) {
    return [ADMIN_HUB, { label: "Lista narudžbi", href: "/admin/orders" }, { label: "Detalji narudžbe" }];
  }
  if (p.startsWith("/admin/suppliers/")) {
    return [ADMIN_HUB, { label: "Dobavljači", href: "/admin/suppliers" }, { label: "Detalji dobavljača" }];
  }
  return null;
}

function decodeSlugTail(pathRest: string): string {
  const seg = pathRest.split("/").filter(Boolean).pop() ?? pathRest;
  return seg.replace(/-/g, " ");
}

function vendorDynamic(_p: string): SiteBreadcrumbItem[] | null {
  return null;
}

/**
 * Segmenti poslije «Početna» za admin/vendor panel (lijenskih match + dinamika).
 */
export function getDashboardBreadcrumbItems(pathname: string): SiteBreadcrumbItem[] {
  const p = (pathname.replace(/\/$/, "") || "/").trim();

  if (p.startsWith("/admin")) {
    if (ADMIN_EXACT[p]) {
      return [{ label: ADMIN_HUB.label, href: ADMIN_HUB.href }, { label: ADMIN_EXACT[p] }];
    }
    const dyn = adminDynamic(p);
    if (dyn) return dyn;
    return [{ label: ADMIN_HUB.label, href: ADMIN_HUB.href }, { label: "Stranica" }];
  }

  if (p.startsWith("/vendor")) {
    if (VENDOR_EXACT[p]) {
      return [{ label: VENDOR_HUB.label, href: VENDOR_HUB.href }, { label: VENDOR_EXACT[p] }];
    }
    const dyn = vendorDynamic(p);
    if (dyn) return dyn;
    return [{ label: VENDOR_HUB.label, href: VENDOR_HUB.href }, { label: "Stranica" }];
  }

  return [];
}
