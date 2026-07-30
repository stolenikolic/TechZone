import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import debounce from "lodash/debounce";
import type { CategorySidebarFilters, RangeFilter, SearchPageFilters } from "models/Filters";
import { clampRangeTuple, parseRangeParamToTuple } from "lib/shop/range-filter-utils";
import {
  cloneFilterParams,
  parseFilterUrlSnapshot,
  toFilterUrlSnapshot
} from "lib/shop/filter-url-snapshot";
import usePendingFilterNavigation from "hooks/usePendingFilterNavigation";
import { getSeoFilterFromPathname } from "utils/seo-filter-slug";

export type ProductFilterCardFilters = CategorySidebarFilters | SearchPageFilters;

const SLIDER_DEBOUNCE_MS = 300;
const defaultPriceRange = [0, 300] as [number, number];

function getParam(
  searchParams: URLSearchParams,
  seoParams: Record<string, string> | null,
  key: string
): string | null {
  const fromQuery = searchParams.get(key);
  if (fromQuery != null && fromQuery !== "") return fromQuery;
  return seoParams?.[key] ?? null;
}

/** URL param key for a filter slug (API uses "brands" for brand). */
function getParamKeyForSlug(slug: string): string {
  return slug === "brand" ? "brands" : slug;
}

/** Normalize brand value for URL (lowercase, spaces to dash). */
function normalizeBrandValue(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-");
}

export default function useProductFilterCard(filters?: ProductFilterCardFilters) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navigation = usePendingFilterNavigation();
  const {
    pendingSnapshot,
    getEffectiveParams,
    getEffectivePathname,
    getEffectiveSnapshot,
    pushUrlAndRefresh,
    isFilterPending,
    isSectionPending,
    filterValuePendingKey,
    pendingFilterKey
  } = navigation;

  const seoFilter = useMemo(
    () => getSeoFilterFromPathname(getEffectivePathname()),
    [getEffectivePathname, pendingSnapshot, pathname]
  );
  const basePathForParams = seoFilter?.basePath ?? getEffectivePathname();
  const hasSeoFilterInPath = Boolean(seoFilter);

  const priceRange = filters?.priceRange;
  const appliedPrices = useMemo(() => {
    if (!priceRange) return defaultPriceRange;
    return parseRangeParamToTuple(getEffectiveParams().get("prices"), priceRange, 1);
  }, [getEffectiveParams, pendingSnapshot, priceRange?.min, priceRange?.max]);

  const [prices, setPrices] = useState<number[]>(appliedPrices);
  const [priceMinInputStr, setPriceMinInputStr] = useState<string>(String(appliedPrices[0]));
  const [priceMaxInputStr, setPriceMaxInputStr] = useState<string>(String(appliedPrices[1]));

  useEffect(() => {
    setPrices(appliedPrices);
    setPriceMinInputStr(String(appliedPrices[0]));
    setPriceMaxInputStr(String(appliedPrices[1]));
  }, [appliedPrices]);

  const handleChangeSearchParams = useCallback(
    (key: string, value: string) => {
      if (!key || value === undefined) return;
      const { pathname: path, params: baseParams } = parseFilterUrlSnapshot(getEffectiveSnapshot());
      const params = cloneFilterParams(baseParams);
      params.delete("page");
      if (value === "") params.delete(key);
      else params.set(key, value);
      pushUrlAndRefresh(toFilterUrlSnapshot(path, params), key);
    },
    [getEffectiveSnapshot, pushUrlAndRefresh]
  );

  const applyPrice = useCallback(() => {
    const min = priceMinInputStr.trim() === "" ? (priceRange?.min ?? 0) : Number(priceMinInputStr);
    const max = priceMaxInputStr.trim() === "" ? (priceRange?.max ?? 300) : Number(priceMaxInputStr);
    const minNum = Number.isFinite(min)
      ? Math.max(priceRange?.min ?? 0, Math.min(priceRange?.max ?? 300, min))
      : (priceRange?.min ?? 0);
    const maxNum = Number.isFinite(max)
      ? Math.max(priceRange?.min ?? 0, Math.min(priceRange?.max ?? 300, max))
      : (priceRange?.max ?? 300);
    const finalMin = Math.min(minNum, maxNum);
    const finalMax = Math.max(minNum, maxNum);
    handleChangeSearchParams("prices", `${finalMin}-${finalMax}`);
  }, [handleChangeSearchParams, priceMinInputStr, priceMaxInputStr, priceRange]);

  const applyPriceWithValues = useCallback(
    (values: number[]) => {
      handleChangeSearchParams("prices", `${values[0]}-${values[1]}`);
    },
    [handleChangeSearchParams]
  );

  const applyPriceWithValuesRef = useRef(applyPriceWithValues);
  applyPriceWithValuesRef.current = applyPriceWithValues;

  const debouncedApplyPriceWithValues = useMemo(
    () => debounce((values: number[]) => applyPriceWithValuesRef.current(values), SLIDER_DEBOUNCE_MS),
    []
  );

  const handleChangePrice = useCallback(
    (values: number[]) => {
      if (!priceRange) return;
      const tuple = clampRangeTuple([values[0], values[1]], priceRange.min, priceRange.max, 1);
      setPrices(tuple);
      setPriceMinInputStr(String(tuple[0]));
      setPriceMaxInputStr(String(tuple[1]));
    },
    [priceRange]
  );

  const handleChangePriceMinInput = useCallback((str: string) => setPriceMinInputStr(str), []);
  const handleChangePriceMaxInput = useCallback((str: string) => setPriceMaxInputStr(str), []);

  const getSelectedValues = useCallback(
    (slug: string): string[] => {
      const key = getParamKeyForSlug(slug);
      const param = getParam(getEffectiveParams(), seoFilter?.params ?? null, key);
      return param ? param.split(",").map((s) => s.trim()).filter(Boolean) : [];
    },
    [getEffectiveParams, seoFilter?.params]
  );

  const getFilterQueryParam = useCallback(
    (key: string) => getParam(getEffectiveParams(), seoFilter?.params ?? null, key),
    [getEffectiveParams, seoFilter?.params]
  );

  const handleFilterChange = useCallback(
    (slug: string, value: string, checked: boolean) => {
      const paramKey = getParamKeyForSlug(slug);
      const normalized = slug === "brand" ? normalizeBrandValue(value) : value;
      const current = getSelectedValues(slug);
      const next = checked
        ? [...current.filter((x) => x !== normalized), normalized]
        : current.filter((x) => x !== normalized);
      const { pathname: path } = parseFilterUrlSnapshot(getEffectiveSnapshot());
      const params = cloneFilterParams(getEffectiveParams());
      params.delete("page");
      if (next.length > 0) params.set(paramKey, next.join(","));
      else params.delete(paramKey);
      const valueKey = filterValuePendingKey(slug, normalized);
      pushUrlAndRefresh(toFilterUrlSnapshot(path, params), [slug, valueKey]);
    },
    [filterValuePendingKey, getEffectiveParams, getEffectiveSnapshot, getSelectedValues, pushUrlAndRefresh]
  );

  const handleAttributeRangeFilterChange = useCallback(
    (slug: string, value: string) => {
      const { pathname: path } = parseFilterUrlSnapshot(getEffectiveSnapshot());
      const params = cloneFilterParams(getEffectiveParams());
      params.delete("page");
      if (!value.trim()) params.delete(slug);
      else params.set(slug, value);
      pushUrlAndRefresh(toFilterUrlSnapshot(path, params), slug);
    },
    [getEffectiveParams, getEffectiveSnapshot, pushUrlAndRefresh]
  );

  const clearFilterParam = useCallback(
    (slug: string) => {
      const { pathname: path } = parseFilterUrlSnapshot(getEffectiveSnapshot());
      const params = cloneFilterParams(getEffectiveParams());
      params.delete("page");
      params.delete(slug);
      const paramKey = getParamKeyForSlug(slug);
      if (paramKey !== slug) params.delete(paramKey);
      pushUrlAndRefresh(toFilterUrlSnapshot(path, params), slug);
    },
    [getEffectiveParams, getEffectiveSnapshot, pushUrlAndRefresh]
  );

  return {
    pendingFilterKey,
    isFilterPending,
    isSectionPending,
    filterValuePendingKey,
    pushUrlAndRefresh,
    getSelectedValues,
    getFilterQueryParam,
    handleFilterChange,
    handleAttributeRangeFilterChange,
    clearFilterParam,
    handleChangeSearchParams,
    priceRange,
    prices,
    priceMinInputStr,
    priceMaxInputStr,
    handleChangePriceMinInput,
    handleChangePriceMaxInput,
    handleChangePrice,
    applyPrice,
    applyPriceWithValues,
    debouncedApplyPriceWithValues,
    basePathForParams,
    hasSeoFilterInPath
  };
}
