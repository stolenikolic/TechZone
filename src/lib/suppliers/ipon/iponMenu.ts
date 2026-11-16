/**
 * Hungarian iPon menu. The two-level feed key is the parent name from the shop
 * HTML plus the plain child name. Filtered hrefs do not own a key.
 */

import { IPON_IMPORT_USER_AGENT, listingUrlHasFilterParams, parseGroupIdFromListingUrl } from "./ipon-fetch";
import { twoLevelFeedKey } from "./productFeed";

const MENU_ORIGIN = "https://ipon.hu";
const KNOWN_SITE_ID = "hu_HU";
const KNOWN_LISTS_VERSION = "7c9bd250178a";
const MIN_MENU_KEYS = 20;

export type IponMenuIndex = {
  version: string;
  listIdByTwoLevelKey: Map<string, string>;
  ownMatchesFilterRule: boolean;
};

type MenuItem = {
  name?: unknown;
  href?: unknown;
  own?: unknown;
};

export function resolveIponMenuUrl(html: string): string | null {
  const siteId = html.match(/siteId\\?":\\?"([a-z]{2}_[A-Z]{2})/)?.[1] ?? null;
  const listsVersion = html.match(/listsVersion\\?":\\?"([a-f0-9]+)/)?.[1] ?? null;
  if (siteId && listsVersion) return `${MENU_ORIGIN}/api/menu/${siteId}-${listsVersion}.json`;
  if (html.includes(`${KNOWN_SITE_ID}-${KNOWN_LISTS_VERSION}`) || html.includes(KNOWN_LISTS_VERSION)) {
    return `${MENU_ORIGIN}/api/menu/${KNOWN_SITE_ID}-${KNOWN_LISTS_VERSION}.json`;
  }
  return null;
}

export function parseMenuParentNames(html: string): Map<string, string> {
  const names = new Map<string, string>();
  const re = /<a\b[^>]*href="(\/shop\/csoport\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
  for (let match = re.exec(html); match; match = re.exec(html)) {
    const parts = match[1]!.split("/").filter(Boolean);
    if (parts.length !== 4) continue;
    const id = parts[3] ?? "";
    if (!/^\d+$/.test(id)) continue;
    const name = match[2]!.replace(/\s+/g, " ").trim();
    if (name) names.set(id, name);
  }
  return names;
}

function menuItems(menu: unknown): MenuItem[] {
  if (!menu || typeof menu !== "object" || Array.isArray(menu)) return [];
  const items: MenuItem[] = [];
  for (const value of Object.values(menu as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (item && typeof item === "object") items.push(item as MenuItem);
    }
  }
  return items;
}

function itemUrl(href: string): URL | null {
  try {
    return new URL(href, MENU_ORIGIN);
  } catch {
    return null;
  }
}

/** True only when plain switch 1129 has own=true and filtered wheel 938 has own=false. */
export function menuOwnMatchesFilterRule(menu: unknown): boolean {
  let plainSwitch: boolean | null = null;
  let filteredWheel: boolean | null = null;
  for (const item of menuItems(menu)) {
    if (typeof item.href !== "string") continue;
    const url = itemUrl(item.href);
    if (!url) continue;
    let listId = "";
    try {
      listId = String(parseGroupIdFromListingUrl(url.toString()));
    } catch {
      continue;
    }
    const filtered = listingUrlHasFilterParams(url.toString());
    if (listId === "1129" && !filtered) plainSwitch = item.own === true;
    if (listId === "938" && filtered) filteredWheel = item.own === false;
  }
  return plainSwitch === true && filteredWheel === true;
}

export function buildIponMenuIndex(html: string, menu: unknown, version: string): IponMenuIndex {
  const parents = parseMenuParentNames(html);
  const listIdByTwoLevelKey = new Map<string, string | null>();
  if (menu && typeof menu === "object" && !Array.isArray(menu)) {
    for (const [parentId, value] of Object.entries(menu as Record<string, unknown>)) {
      const parentName = parents.get(parentId);
      if (!parentName || !Array.isArray(value)) continue;
      for (const item of value) {
        if (!item || typeof item !== "object") continue;
        const rec = item as MenuItem;
        if (typeof rec.name !== "string" || typeof rec.href !== "string") continue;
        const childName = rec.name.trim();
        if (!childName) continue;
        const url = itemUrl(rec.href);
        if (!url) continue;
        if (listingUrlHasFilterParams(url.toString())) continue;
        let listId = "";
        try {
          listId = String(parseGroupIdFromListingUrl(url.toString()));
        } catch {
          continue;
        }
        const key = `${parentName} > ${childName}`;
        const current = listIdByTwoLevelKey.get(key);
        if (current == null && !listIdByTwoLevelKey.has(key)) listIdByTwoLevelKey.set(key, listId);
        else if (current !== listId) listIdByTwoLevelKey.set(key, null);
      }
    }
  }

  const clean = new Map<string, string>();
  for (const [key, listId] of Array.from(listIdByTwoLevelKey.entries())) {
    if (listId) clean.set(key, listId);
  }
  return {
    version,
    listIdByTwoLevelKey: clean,
    ownMatchesFilterRule: menuOwnMatchesFilterRule(menu)
  };
}

export function listIdForCategoryPath(index: IponMenuIndex, categoryPath: string | null): string | null {
  const key = twoLevelFeedKey(categoryPath);
  if (!key) return null;
  return index.listIdByTwoLevelKey.get(key) ?? null;
}

async function fetchIponText(url: string, acceptJson: boolean): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": IPON_IMPORT_USER_AGENT,
      Accept: acceptJson ? "application/json, text/plain, */*" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8",
      Referer: `${MENU_ORIGIN}/`
    },
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`iPon meni HTTP ${res.status}: ${url}`);
  return res.text();
}

export async function loadIponHungarianMenu(_jar: Map<string, string>): Promise<IponMenuIndex> {
  const html = await fetchIponText(`${MENU_ORIGIN}/`, false);
  const menuUrl = resolveIponMenuUrl(html);
  if (!menuUrl) throw new Error("ipon.hu nem daje siteId i listsVersion.");
  const body = await fetchIponText(menuUrl, true);
  let menu: unknown;
  try {
    menu = JSON.parse(body) as unknown;
  } catch {
    throw new Error("iPon meni nije JSON.");
  }
  const version = menuUrl.match(/-([a-f0-9]+)\.json$/)?.[1] ?? "";
  const index = buildIponMenuIndex(html, menu, version);
  console.log(
    `[iPon menu] ${index.version}, ključeva ${index.listIdByTwoLevelKey.size}, own=${index.ownMatchesFilterRule}`
  );
  if (!index.ownMatchesFilterRule) {
    console.log("[iPon menu] Polje own ne razdvaja običnu listu od filtera. Ključ koristi href bez filter parametara.");
  }
  if (index.listIdByTwoLevelKey.size < MIN_MENU_KEYS) {
    throw new Error(`iPon meni ima samo ${index.listIdByTwoLevelKey.size} ključeva.`);
  }
  return index;
}
