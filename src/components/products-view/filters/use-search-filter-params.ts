"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { cloneFilterParams, toFilterUrlSnapshot } from "lib/shop/filter-url-snapshot";
import usePendingFilterNavigation from "hooks/usePendingFilterNavigation";
import { parseRangeParamToTuple } from "lib/shop/range-filter-utils";
import {
  formatCategorySlugsParam,
  parseCategorySlugsParam
} from "lib/search/product-search-tokens";
import type { SearchPageFilters } from "models/Filters";
import type { ActiveFilterChip } from "./active-filter-chips";

function normalizeBrandSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function parseBrandSlugs(param: string | null): string[] {
  if (!param?.trim()) return [];
  return param
    .split(",")
    .map((slug) => slug.trim().toLowerCase())
    .filter(Boolean);
}

export default function useSearchFilterParams(filters: SearchPageFilters) {
  const searchParams = useSearchParams();
  const {
    pendingSnapshot,
    getEffectiveParams,
    getEffectivePathname,
    pushUrlAndRefresh,
    isFilterPending,
    isSectionPending,
    filterValuePendingKey
  } = usePendingFilterNavigation();

  const pushParams = useCallback(
    (mutate: (params: URLSearchParams) => void, filterKeys: string | string[]) => {
      const path = getEffectivePathname();
      const params = cloneFilterParams(getEffectiveParams());
      params.delete("page");
      mutate(params);
      pushUrlAndRefresh(toFilterUrlSnapshot(path, params), filterKeys);
    },
    [getEffectiveParams, getEffectivePathname, pushUrlAndRefresh]
  );

  const selectedCategorySlugs = useMemo(
    () => parseCategorySlugsParam(getEffectiveParams().get("category")),
    [getEffectiveParams, pendingSnapshot]
  );

  const selectedBrandSlugs = useMemo(
    () => parseBrandSlugs(getEffectiveParams().get("brands")),
    [getEffectiveParams, pendingSnapshot]
  );

  const categoryFacetBySlug = useMemo(
    () => new Map(filters.searchCategoryFacets.map((facet) => [facet.slug.toLowerCase(), facet])),
    [filters.searchCategoryFacets]
  );

  const brandValues = useMemo(
    () => filters.filters.find((item) => item.slug === "brand")?.values ?? [],
    [filters.filters]
  );

  const brandNameBySlug = useMemo(() => {
    const map = new Map<string, string>();
    brandValues.forEach((name) => map.set(normalizeBrandSlug(name), name));
    return map;
  }, [brandValues]);

  const priceChip = useMemo((): ActiveFilterChip | null => {
    const priceRange = filters.priceRange;
    if (!priceRange) return null;

    const [min, max] = parseRangeParamToTuple(getEffectiveParams().get("prices"), priceRange, 1);
    const isDefault = min === priceRange.min && max === priceRange.max;
    if (isDefault) return null;

    return {
      id: "price",
      label: `${min} – ${max} KM`
    };
  }, [filters.priceRange, getEffectiveParams, pendingSnapshot]);

  const chips = useMemo((): ActiveFilterChip[] => {
    const items: ActiveFilterChip[] = [];

    selectedCategorySlugs.forEach((slug) => {
      const facet = categoryFacetBySlug.get(slug);
      items.push({
        id: `category:${slug}`,
        label: facet?.name ?? slug
      });
    });

    selectedBrandSlugs.forEach((slug) => {
      items.push({
        id: `brand:${slug}`,
        label: brandNameBySlug.get(slug) ?? slug.toUpperCase()
      });
    });

    if (priceChip) items.push(priceChip);

    return items;
  }, [brandNameBySlug, categoryFacetBySlug, priceChip, selectedBrandSlugs, selectedCategorySlugs]);

  const removeChip = useCallback(
    (chip: ActiveFilterChip) => {
      pushParams((params) => {
        if (chip.id.startsWith("category:")) {
          const slug = chip.id.replace("category:", "");
          const next = parseCategorySlugsParam(params.get("category")).filter((item) => item !== slug);
          if (next.length === 0) params.delete("category");
          else params.set("category", formatCategorySlugsParam(next));
        } else if (chip.id.startsWith("brand:")) {
          const slug = chip.id.replace("brand:", "");
          const next = parseBrandSlugs(params.get("brands")).filter((item) => item !== slug);
          if (next.length === 0) params.delete("brands");
          else params.set("brands", next.join(","));
        } else if (chip.id === "price") {
          params.delete("prices");
        }
      }, chip.id);
    },
    [pushParams]
  );

  const clearAllFilters = useCallback(() => {
    pushParams((params) => {
      params.delete("category");
      params.delete("brands");
      params.delete("prices");
    }, "clear");
  }, [pushParams]);

  const toggleCategory = useCallback(
    (slug: string) => {
      const normalized = slug.trim().toLowerCase();
      pushParams((params) => {
        const current = parseCategorySlugsParam(params.get("category"));
        const next = current.includes(normalized)
          ? current.filter((item) => item !== normalized)
          : [...current, normalized];
        if (next.length === 0) params.delete("category");
        else params.set("category", formatCategorySlugsParam(next));
      }, ["category", filterValuePendingKey("category", normalized)]);
    },
    [filterValuePendingKey, pushParams]
  );

  return {
    chips,
    hasActiveFilters: chips.length > 0,
    removeChip,
    clearAllFilters,
    toggleCategory,
    selectedCategorySlugs,
    isFilterPending,
    isSectionPending,
    filterValuePendingKey,
    /** Za price slider u search sidebaru. */
    getEffectiveParams,
    pendingSnapshot
  };
}
