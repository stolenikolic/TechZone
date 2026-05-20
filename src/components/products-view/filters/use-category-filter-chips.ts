"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { CategorySidebarFilters, FilterItem } from "models/Filters";
import { parseRangeParamToTuple } from "lib/shop/range-filter-utils";
import { getSeoFilterFromPathname } from "utils/seo-filter-slug";
import type { ActiveFilterChip } from "./active-filter-chips";
import useProductFilterCard from "./use-product-filter-card";

function normalizeBrandSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function formatFilterValue(slug: string, value: string): string {
  if (slug === "heatsink" && (value === "true" || value === "false")) {
    return value === "true" ? "Yes" : "No";
  }
  return value === "-" ? "N/A (SATA)" : value;
}

function getParam(
  searchParams: URLSearchParams,
  seoParams: Record<string, string> | null,
  key: string
): string | null {
  const fromQuery = searchParams.get(key);
  if (fromQuery != null && fromQuery !== "") return fromQuery;
  return seoParams?.[key] ?? null;
}

function getSelectedValues(
  searchParams: URLSearchParams,
  seoParams: Record<string, string> | null,
  slug: string
): string[] {
  const key = slug === "brand" ? "brands" : slug;
  const param = getParam(searchParams, seoParams, key);
  return param ? param.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

function buildAttributeChips(
  filter: FilterItem,
  searchParams: URLSearchParams,
  seoParams: Record<string, string> | null
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (filter.displayType === "range" && filter.range) {
    const param = getParam(searchParams, seoParams, filter.slug);
    if (!param?.trim()) return chips;

    const [min, max] = parseRangeParamToTuple(param, filter.range, filter.step ?? 1);
    const isDefault = min === filter.range.min && max === filter.range.max;
    if (isDefault) return chips;

    const unit = filter.unit ? ` ${filter.unit}` : "";
    chips.push({
      id: `range:${filter.slug}`,
      label: `${filter.name}: ${min}–${max}${unit}`
    });
    return chips;
  }

  const selected = getSelectedValues(searchParams, seoParams, filter.slug);

  selected.forEach((raw) => {
    const displayValue = formatFilterValue(filter.slug, raw);
    chips.push({
      id: `attr:${filter.slug}:${raw}`,
      label: `${filter.name}: ${displayValue}`
    });
  });

  return chips;
}

export default function useCategoryFilterChips(filters: CategorySidebarFilters) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const seoFilter = useMemo(() => getSeoFilterFromPathname(pathname), [pathname]);
  const seoParams = seoFilter?.params ?? null;
  const basePathForParams = seoFilter?.basePath ?? pathname;

  const { handleFilterChange, clearFilterParam, pushUrlAndRefresh } = useProductFilterCard(filters);

  const brandFilter = filters.filters.find((item) => item.slug === "brand");
  const brandNameBySlug = useMemo(() => {
    const map = new Map<string, string>();
    (brandFilter?.values ?? []).forEach((name) => map.set(normalizeBrandSlug(name), name));
    return map;
  }, [brandFilter?.values]);

  const chips = useMemo((): ActiveFilterChip[] => {
    const items: ActiveFilterChip[] = [];

    getSelectedValues(searchParams, seoParams, "brand").forEach((slug) => {
      items.push({
        id: `brand:${slug}`,
        label: brandNameBySlug.get(slug) ?? slug.toUpperCase()
      });
    });

    if (filters.priceRange) {
      const [min, max] = parseRangeParamToTuple(searchParams.get("prices"), filters.priceRange, 1);
      const isDefault = min === filters.priceRange.min && max === filters.priceRange.max;
      if (!isDefault) {
        items.push({
          id: "price",
          label: `${min} – ${max} KM`
        });
      }
    }

    filters.filters.forEach((filter) => {
      if (filter.slug === "brand") return;
      items.push(...buildAttributeChips(filter, searchParams, seoParams));
    });

    return items;
  }, [brandNameBySlug, filters.filters, filters.priceRange, searchParams, seoParams]);

  const removeChip = useCallback(
    (chip: ActiveFilterChip) => {
      if (chip.id.startsWith("brand:")) {
        const slug = chip.id.replace("brand:", "");
        const displayName = brandNameBySlug.get(slug) ?? slug;
        handleFilterChange("brand", displayName, false);
        return;
      }

      if (chip.id === "price") {
        const params = new URLSearchParams(searchParams);
        params.delete("prices");
        params.delete("page");
        const query = params.toString();
        pushUrlAndRefresh(query ? `${pathname}?${query}` : pathname, "prices");
        return;
      }

      if (chip.id.startsWith("range:")) {
        const slug = chip.id.replace("range:", "");
        clearFilterParam(slug);
        return;
      }

      if (chip.id.startsWith("attr:")) {
        const parts = chip.id.split(":");
        const slug = parts[1];
        const urlValue = parts.slice(2).join(":");
        const filter = filters.filters.find((item) => item.slug === slug);
        const displayValue =
          filter?.values.find((value) => value === urlValue || normalizeBrandSlug(value) === urlValue) ??
          urlValue;
        handleFilterChange(slug, displayValue, false);
      }
    },
    [
      brandNameBySlug,
      clearFilterParam,
      filters.filters,
      handleFilterChange,
      pathname,
      pushUrlAndRefresh,
      searchParams
    ]
  );

  const clearAllFilters = useCallback(() => {
    const params = new URLSearchParams();
    const sort = searchParams.get("sort");
    const view = searchParams.get("view");
    if (sort) params.set("sort", sort);
    if (view) params.set("view", view);
    const query = params.toString();
    pushUrlAndRefresh(query ? `${basePathForParams}?${query}` : basePathForParams, "all");
  }, [basePathForParams, pushUrlAndRefresh, searchParams]);

  return {
    chips,
    hasActiveFilters: chips.length > 0,
    removeChip,
    clearAllFilters
  };
}
