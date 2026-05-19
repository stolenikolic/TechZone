import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import debounce from "lodash/debounce";
import type Filters from "models/Filters";
import type { CategorySidebarFilters } from "models/Filters";
import { clampRangeTuple, parseRangeParamToTuple } from "lib/shop/range-filter-utils";
import { getSeoFilterFromPathname } from "utils/seo-filter-slug";

export type ProductFilterCardFilters = Filters | CategorySidebarFilters;

const SLIDER_DEBOUNCE_MS = 300;

const defaultPriceRange = [0, 300] as [number, number];

/** Extract category path from pathname (e.g. /categories/parent/child -> "parent/child"). */
function getCategoryPathFromBasePath(basePath: string): string {
  const segments = basePath.split("/").filter(Boolean);
  if (segments[0] !== "categories" || segments.length < 2) return "";
  return segments.slice(1, 3).join("/");
}

/**
 * Build SEO path segments: brand first, then capacity only when single value (e.g. wd/12tb).
 * Capacity range (min !== max) is never in the path; it goes in query only.
 */
function buildSeoPathSegments(brands: string[], capacity: number[]): string[] {
  const segments: string[] = [];
  if (brands.length === 1) segments.push(brands[0].toLowerCase().trim());
  const capacitySingle = capacity[0] === capacity[1] && Number.isFinite(capacity[0]);
  if (capacitySingle && capacity[0] > 0) segments.push(`${capacity[0]}tb`);
  return segments;
}

/** True when we use path for brand/capacity: single brand and (single capacity or no capacity in path). */
function canUseSeoPathForBrandCapacity(brands: string[], capacity: number[]): boolean {
  return brands.length <= 1;
}

/** Format capacity for query param: single value → "12", range → "6-12". */
function formatCapacityParam(capacity: number[]): string {
  return capacity[0] === capacity[1] ? String(capacity[0]) : `${capacity[0]}-${capacity[1]}`;
}

/** Parse dash-separated "min-max" (range slider URL format) into [number, number]. */
function parseRangeParam(
  param: string | null,
  range: Filters["priceRange"]
): [number, number] {
  if (!param?.trim()) {
    return range ? [range.min, range.max] : defaultPriceRange;
  }
  const parts = param.split("-").map((s) => Number(s.trim()));
  if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return [parts[0], parts[1]];
  }
  return range ? [range.min, range.max] : defaultPriceRange;
}

function getParam(searchParams: URLSearchParams, seoParams: Record<string, string> | null, key: string): string | null {
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(true);
  const [pendingFilterKey, setPendingFilterKey] = useState<string | null>(null);
  const pendingFilterKeyRef = useRef<string | null>(null);
  const urlSnapshotRef = useRef(`${pathname}?${searchParams.toString()}`);

  /** Clear spinner after URL updates and refresh has time to complete. */
  useEffect(() => {
    const next = `${pathname}?${searchParams.toString()}`;
    if (!pendingFilterKeyRef.current) {
      urlSnapshotRef.current = next;
      return;
    }
    if (next === urlSnapshotRef.current) return;

    urlSnapshotRef.current = next;
    const timer = window.setTimeout(() => {
      pendingFilterKeyRef.current = null;
      setPendingFilterKey(null);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [pathname, searchParams]);

  /** Push URL then refresh; filterKey shows spinner beside that filter title. */
  const pushUrlAndRefresh = useCallback(
    (url: string, filterKey: string) => {
      pendingFilterKeyRef.current = filterKey;
      setPendingFilterKey(filterKey);
      router.push(url, { scroll: false });
      setTimeout(() => {
        router.refresh();
      }, 0);
    },
    [router]
  );

  const seoFilter = useMemo(() => getSeoFilterFromPathname(pathname), [pathname]);
  const basePathForParams = seoFilter?.basePath ?? pathname;

  const priceRange = filters?.priceRange;
  const appliedPrices = useMemo(() => {
    if (!priceRange) return defaultPriceRange;
    return parseRangeParamToTuple(searchParams.get("prices"), priceRange, 1);
  }, [searchParams, priceRange?.min, priceRange?.max]);
  const [prices, setPrices] = useState<number[]>(appliedPrices);
  const [priceMinInputStr, setPriceMinInputStr] = useState<string>(String(appliedPrices[0]));
  const [priceMaxInputStr, setPriceMaxInputStr] = useState<string>(String(appliedPrices[1]));
  useEffect(() => {
    setPrices(appliedPrices);
    setPriceMinInputStr(String(appliedPrices[0]));
    setPriceMaxInputStr(String(appliedPrices[1]));
  }, [appliedPrices]);

  const rating = useMemo<number>(
    () => JSON.parse(searchParams.get("rating") || "0"),
    [searchParams]
  );

  const colors = useMemo<string[]>(
    () => JSON.parse(searchParams.get("colors") || "[]"),
    [searchParams]
  );

  const sales = useMemo<string[]>(
    () => JSON.parse(searchParams.get("sales") || "[]"),
    [searchParams]
  );

  const brands = useMemo<string[]>(() => {
    const param = getParam(searchParams, seoFilter?.params ?? null, "brands");
    return param ? param.split(",").map((s) => s.trim()).filter(Boolean) : [];
  }, [searchParams, seoFilter?.params]);

  const capacityRange = (filters as Filters | undefined)?.capacityRange;
  const capacity = useMemo<number[]>(() => {
    if (!capacityRange) return [0, 0];
    const param = getParam(searchParams, seoFilter?.params ?? null, "capacity");
    return parseRangeParamToTuple(param, capacityRange, 1);
  }, [searchParams, seoFilter?.params, capacityRange?.min, capacityRange?.max]);

  const [localCapacity, setLocalCapacity] = useState<number[]>(capacity);
  const [capacityMinInputStr, setCapacityMinInputStr] = useState<string>(String(capacity[0]));
  const [capacityMaxInputStr, setCapacityMaxInputStr] = useState<string>(String(capacity[1]));
  useEffect(() => {
    setLocalCapacity(capacity);
    setCapacityMinInputStr(String(capacity[0]));
    setCapacityMaxInputStr(String(capacity[1]));
  }, [capacity]);

  const rpmRange = (filters as Filters | undefined)?.rpmRange;
  const rpm = useMemo<number[]>(() => {
    if (!rpmRange) return [0, 0];
    const param = getParam(searchParams, seoFilter?.params ?? null, "rpm");
    return parseRangeParamToTuple(param, rpmRange, 1);
  }, [searchParams, seoFilter?.params, rpmRange?.min, rpmRange?.max]);

  const [localRpm, setLocalRpm] = useState<number[]>(rpm);
  const [rpmMinInputStr, setRpmMinInputStr] = useState<string>(String(rpm[0]));
  const [rpmMaxInputStr, setRpmMaxInputStr] = useState<string>(String(rpm[1]));
  useEffect(() => {
    setLocalRpm(rpm);
    setRpmMinInputStr(String(rpm[0]));
    setRpmMaxInputStr(String(rpm[1]));
  }, [rpm]);

  const bufferRange = (filters as Filters | undefined)?.bufferRange;
  const buffer = useMemo<number[]>(() => {
    if (!bufferRange) return [0, 0];
    const param = getParam(searchParams, seoFilter?.params ?? null, "buffer");
    return parseRangeParamToTuple(param, bufferRange, 1);
  }, [searchParams, seoFilter?.params, bufferRange?.min, bufferRange?.max]);

  const [localBuffer, setLocalBuffer] = useState<number[]>(buffer);
  const [bufferMinInputStr, setBufferMinInputStr] = useState<string>(String(buffer[0]));
  const [bufferMaxInputStr, setBufferMaxInputStr] = useState<string>(String(buffer[1]));
  useEffect(() => {
    setLocalBuffer(buffer);
    setBufferMinInputStr(String(buffer[0]));
    setBufferMaxInputStr(String(buffer[1]));
  }, [buffer]);

  const sizeSelections = useMemo<string[]>(() => {
    const param = getParam(searchParams, seoFilter?.params ?? null, "size");
    return param ? param.split(",").map((s) => s.trim()).filter(Boolean) : [];
  }, [searchParams, seoFilter?.params]);

  const connectionSelections = useMemo<string[]>(() => {
    const param = getParam(searchParams, seoFilter?.params ?? null, "connection");
    return param ? param.split(",").map((s) => s.trim()).filter(Boolean) : [];
  }, [searchParams, seoFilter?.params]);

  const readSpeedRange = (filters as Filters | undefined)?.readSpeedRange;
  const readSpeed = useMemo<number[]>(() => {
    if (!readSpeedRange) return [0, 0];
    const param = getParam(searchParams, seoFilter?.params ?? null, "read_speed");
    return parseRangeParamToTuple(param, readSpeedRange, 1);
  }, [searchParams, seoFilter?.params, readSpeedRange?.min, readSpeedRange?.max]);

  const [localReadSpeed, setLocalReadSpeed] = useState<number[]>(readSpeed);
  const [readSpeedMinInputStr, setReadSpeedMinInputStr] = useState<string>(String(readSpeed[0]));
  const [readSpeedMaxInputStr, setReadSpeedMaxInputStr] = useState<string>(String(readSpeed[1]));
  useEffect(() => {
    setLocalReadSpeed(readSpeed);
    setReadSpeedMinInputStr(String(readSpeed[0]));
    setReadSpeedMaxInputStr(String(readSpeed[1]));
  }, [readSpeed]);

  const writeSpeedRange = (filters as Filters | undefined)?.writeSpeedRange;
  const writeSpeed = useMemo<number[]>(() => {
    if (!writeSpeedRange) return [0, 0];
    const param = getParam(searchParams, seoFilter?.params ?? null, "write_speed");
    return parseRangeParamToTuple(param, writeSpeedRange, 1);
  }, [searchParams, seoFilter?.params, writeSpeedRange?.min, writeSpeedRange?.max]);

  const [localWriteSpeed, setLocalWriteSpeed] = useState<number[]>(writeSpeed);
  const [writeSpeedMinInputStr, setWriteSpeedMinInputStr] = useState<string>(String(writeSpeed[0]));
  const [writeSpeedMaxInputStr, setWriteSpeedMaxInputStr] = useState<string>(String(writeSpeed[1]));
  useEffect(() => {
    setLocalWriteSpeed(writeSpeed);
    setWriteSpeedMinInputStr(String(writeSpeed[0]));
    setWriteSpeedMaxInputStr(String(writeSpeed[1]));
  }, [writeSpeed]);

  const pcieGenerationSelections = useMemo<string[]>(() => {
    const param = getParam(searchParams, seoFilter?.params ?? null, "pcie_generation");
    return param ? param.split(",").map((s) => s.trim()).filter(Boolean) : [];
  }, [searchParams, seoFilter?.params]);

  const heatsinkSelections = useMemo<string[]>(() => {
    const param = getParam(searchParams, seoFilter?.params ?? null, "heatsink");
    return param ? param.split(",").map((s) => s.trim()).filter(Boolean) : [];
  }, [searchParams, seoFilter?.params]);

  /**
   * Update only UI filters (rpm, buffer, size, price, rating, etc.) in query.
   * SEO filters (brands, capacity) must never appear in query — they live in the path.
   */
  const isProductSearchPage = pathname.startsWith("/products/search");

  const handleChangeSearchParams = useCallback(
    (key: string, value: string) => {
      if (!key || value === undefined) return;
      const params = new URLSearchParams(searchParams);
      if (!isProductSearchPage) {
        params.delete("brands");
        params.delete("capacity");
      }
      params.delete("page");
      if (value === "") params.delete(key);
      else params.set(key, value);
      const query = params.toString();
      pushUrlAndRefresh(query ? `${pathname}?${query}` : pathname, key);
    },
    [isProductSearchPage, pathname, pushUrlAndRefresh, searchParams]
  );

  /**
   * SEO filters (brand, capacity) always live in the path when representable.
   * Single brand and/or single capacity → update path segments; keep UI filters in query.
   * Multiple brands or capacity range → path = category base only; brands/capacity in query.
   */
  const navigateWithFilterState = useCallback(
    (nextBrands: string[], nextCapacity: number[], filterKey: string) => {
      const categoryPath = getCategoryPathFromBasePath(basePathForParams);
      const useSeoPath = categoryPath && canUseSeoPathForBrandCapacity(nextBrands, nextCapacity);

      if (useSeoPath) {
        const seoSegments = buildSeoPathSegments(nextBrands, nextCapacity);
        const newPath =
          seoSegments.length > 0
            ? `${basePathForParams}/${seoSegments.join("/")}`
            : basePathForParams;
        const params = new URLSearchParams(searchParams);
        params.delete("brands");
        params.delete("capacity");
        params.delete("page");
        const isDefaultCapacity =
          nextCapacity[0] === capacityRange?.min && nextCapacity[1] === capacityRange?.max;
        if (nextCapacity[0] !== nextCapacity[1] && !isDefaultCapacity) {
          params.set("capacity", formatCapacityParam(nextCapacity));
        }
        const query = params.toString();
        pushUrlAndRefresh(query ? `${newPath}?${query}` : newPath, filterKey);
        return;
      }

      // Multiple brands or capacity range: cannot use path; put brands/capacity in query only.
      const params = new URLSearchParams(searchParams);
      params.delete("brands");
      params.delete("capacity");
      params.delete("page");
      if (nextBrands.length) params.set("brands", nextBrands.join(","));
      const isDefaultCapacityFallback =
        nextCapacity[0] === capacityRange?.min && nextCapacity[1] === capacityRange?.max;
      if (!isDefaultCapacityFallback) {
        params.set("capacity", formatCapacityParam(nextCapacity));
      }
      const query = params.toString();
      pushUrlAndRefresh(query ? `${basePathForParams}?${query}` : basePathForParams, filterKey);
    },
    [basePathForParams, pushUrlAndRefresh, searchParams, capacityRange?.min, capacityRange?.max]
  );

  const applyPrice = useCallback(() => {
    const min = priceMinInputStr.trim() === "" ? (priceRange?.min ?? 0) : Number(priceMinInputStr);
    const max = priceMaxInputStr.trim() === "" ? (priceRange?.max ?? 300) : Number(priceMaxInputStr);
    const minNum = Number.isFinite(min) ? Math.max(priceRange?.min ?? 0, Math.min(priceRange?.max ?? 300, min)) : (priceRange?.min ?? 0);
    const maxNum = Number.isFinite(max) ? Math.max(priceRange?.min ?? 0, Math.min(priceRange?.max ?? 300, max)) : (priceRange?.max ?? 300);
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

  const setRangeParam = useCallback(
    (key: "capacity" | "rpm" | "buffer" | "read_speed" | "write_speed", values: number[]) => {
      if (key === "capacity") {
        navigateWithFilterState(brands, values, "capacity");
        return;
      }
      handleChangeSearchParams(key, `${values[0]}-${values[1]}`);
    },
    [handleChangeSearchParams, navigateWithFilterState, brands]
  );

  const parseRangeFromInputStrings = useCallback(
    (
      minStr: string,
      maxStr: string,
      range: { min: number; max: number } | undefined,
      step = 1
    ): [number, number] => {
      if (!range) return [0, 0];
      const min = minStr.trim() === "" ? range.min : Number(minStr);
      const max = maxStr.trim() === "" ? range.max : Number(maxStr);
      return clampRangeTuple([min, max], range.min, range.max, step);
    },
    []
  );

  const applyCapacity = useCallback(
    (values?: number[]) => {
      const v = values ?? (capacityRange ? parseRangeFromInputStrings(capacityMinInputStr, capacityMaxInputStr, capacityRange) : [0, 0]);
      setRangeParam("capacity", v);
    },
    [setRangeParam, capacityRange, capacityMinInputStr, capacityMaxInputStr, parseRangeFromInputStrings]
  );
  const applyRpm = useCallback(
    (values?: number[]) => {
      const v = values ?? (rpmRange ? parseRangeFromInputStrings(rpmMinInputStr, rpmMaxInputStr, rpmRange) : [0, 0]);
      setRangeParam("rpm", v);
    },
    [setRangeParam, rpmRange, rpmMinInputStr, rpmMaxInputStr, parseRangeFromInputStrings]
  );
  const applyBuffer = useCallback(
    (values?: number[]) => {
      const v = values ?? (bufferRange ? parseRangeFromInputStrings(bufferMinInputStr, bufferMaxInputStr, bufferRange) : [0, 0]);
      setRangeParam("buffer", v);
    },
    [setRangeParam, bufferRange, bufferMinInputStr, bufferMaxInputStr, parseRangeFromInputStrings]
  );

  const applyReadSpeed = useCallback(
    (values?: number[]) => {
      const v = values ?? (readSpeedRange ? parseRangeFromInputStrings(readSpeedMinInputStr, readSpeedMaxInputStr, readSpeedRange) : [0, 0]);
      setRangeParam("read_speed", v);
    },
    [setRangeParam, readSpeedRange, readSpeedMinInputStr, readSpeedMaxInputStr, parseRangeFromInputStrings]
  );
  const applyWriteSpeed = useCallback(
    (values?: number[]) => {
      const v = values ?? (writeSpeedRange ? parseRangeFromInputStrings(writeSpeedMinInputStr, writeSpeedMaxInputStr, writeSpeedRange) : [0, 0]);
      setRangeParam("write_speed", v);
    },
    [setRangeParam, writeSpeedRange, writeSpeedMinInputStr, writeSpeedMaxInputStr, parseRangeFromInputStrings]
  );

  const applyPriceWithValuesRef = useRef(applyPriceWithValues);
  applyPriceWithValuesRef.current = applyPriceWithValues;
  const applyCapacityRef = useRef(applyCapacity);
  applyCapacityRef.current = applyCapacity;
  const applyRpmRef = useRef(applyRpm);
  applyRpmRef.current = applyRpm;
  const applyBufferRef = useRef(applyBuffer);
  applyBufferRef.current = applyBuffer;
  const applyReadSpeedRef = useRef(applyReadSpeed);
  applyReadSpeedRef.current = applyReadSpeed;
  const applyWriteSpeedRef = useRef(applyWriteSpeed);
  applyWriteSpeedRef.current = applyWriteSpeed;

  const debouncedApplyPriceWithValues = useMemo(
    () => debounce((values: number[]) => applyPriceWithValuesRef.current(values), SLIDER_DEBOUNCE_MS),
    []
  );
  const debouncedApplyCapacity = useMemo(
    () => debounce((values: number[]) => applyCapacityRef.current(values), SLIDER_DEBOUNCE_MS),
    []
  );
  const debouncedApplyRpm = useMemo(
    () => debounce((values: number[]) => applyRpmRef.current(values), SLIDER_DEBOUNCE_MS),
    []
  );
  const debouncedApplyBuffer = useMemo(
    () => debounce((values: number[]) => applyBufferRef.current(values), SLIDER_DEBOUNCE_MS),
    []
  );
  const debouncedApplyReadSpeed = useMemo(
    () => debounce((values: number[]) => applyReadSpeedRef.current(values), SLIDER_DEBOUNCE_MS),
    []
  );
  const debouncedApplyWriteSpeed = useMemo(
    () => debounce((values: number[]) => applyWriteSpeedRef.current(values), SLIDER_DEBOUNCE_MS),
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

  const handleChangeCapacity = useCallback(
    (values: number[]) => {
      if (!capacityRange) return;
      const tuple = clampRangeTuple([values[0], values[1]], capacityRange.min, capacityRange.max, 1);
      setLocalCapacity(tuple);
      setCapacityMinInputStr(String(tuple[0]));
      setCapacityMaxInputStr(String(tuple[1]));
    },
    [capacityRange]
  );
  const handleChangeCapacityMinInput = useCallback((str: string) => setCapacityMinInputStr(str), []);
  const handleChangeCapacityMaxInput = useCallback((str: string) => setCapacityMaxInputStr(str), []);

  const handleChangeRpm = useCallback(
    (values: number[]) => {
      if (!rpmRange) return;
      const tuple = clampRangeTuple([values[0], values[1]], rpmRange.min, rpmRange.max, 1);
      setLocalRpm(tuple);
      setRpmMinInputStr(String(tuple[0]));
      setRpmMaxInputStr(String(tuple[1]));
    },
    [rpmRange]
  );
  const handleChangeRpmMinInput = useCallback((str: string) => setRpmMinInputStr(str), []);
  const handleChangeRpmMaxInput = useCallback((str: string) => setRpmMaxInputStr(str), []);

  const handleChangeBuffer = useCallback(
    (values: number[]) => {
      if (!bufferRange) return;
      const tuple = clampRangeTuple([values[0], values[1]], bufferRange.min, bufferRange.max, 1);
      setLocalBuffer(tuple);
      setBufferMinInputStr(String(tuple[0]));
      setBufferMaxInputStr(String(tuple[1]));
    },
    [bufferRange]
  );
  const handleChangeBufferMinInput = useCallback((str: string) => setBufferMinInputStr(str), []);
  const handleChangeBufferMaxInput = useCallback((str: string) => setBufferMaxInputStr(str), []);

  const handleChangeSize = useCallback(
    (value: string) => {
      const values = sizeSelections.includes(value)
        ? sizeSelections.filter((item) => item !== value)
        : [...sizeSelections, value];
      handleChangeSearchParams("size", values.join(","));
    },
    [sizeSelections, handleChangeSearchParams]
  );

  const handleChangeConnection = useCallback(
    (value: string) => {
      const values = (connectionSelections ?? []).includes(value)
        ? (connectionSelections ?? []).filter((item) => item !== value)
        : [...(connectionSelections ?? []), value];
      handleChangeSearchParams("connection", values.join(","));
    },
    [connectionSelections, handleChangeSearchParams]
  );

  const handleChangePcieGeneration = useCallback(
    (value: string) => {
      const values = (pcieGenerationSelections ?? []).includes(value)
        ? (pcieGenerationSelections ?? []).filter((item) => item !== value)
        : [...(pcieGenerationSelections ?? []), value];
      handleChangeSearchParams("pcie_generation", values.join(","));
    },
    [pcieGenerationSelections, handleChangeSearchParams]
  );

  const handleChangeHeatsink = useCallback(
    (value: string) => {
      const values = (heatsinkSelections ?? []).includes(value)
        ? (heatsinkSelections ?? []).filter((item) => item !== value)
        : [...(heatsinkSelections ?? []), value];
      handleChangeSearchParams("heatsink", values.join(","));
    },
    [heatsinkSelections, handleChangeSearchParams]
  );

  const handleChangeReadSpeed = useCallback(
    (values: number[]) => {
      if (!readSpeedRange) return;
      const tuple = clampRangeTuple([values[0], values[1]], readSpeedRange.min, readSpeedRange.max, 1);
      setLocalReadSpeed(tuple);
      setReadSpeedMinInputStr(String(tuple[0]));
      setReadSpeedMaxInputStr(String(tuple[1]));
    },
    [readSpeedRange]
  );
  const handleChangeReadSpeedMinInput = useCallback((str: string) => setReadSpeedMinInputStr(str), []);
  const handleChangeReadSpeedMaxInput = useCallback((str: string) => setReadSpeedMaxInputStr(str), []);

  const handleChangeWriteSpeed = useCallback(
    (values: number[]) => {
      if (!writeSpeedRange) return;
      const tuple = clampRangeTuple([values[0], values[1]], writeSpeedRange.min, writeSpeedRange.max, 1);
      setLocalWriteSpeed(tuple);
      setWriteSpeedMinInputStr(String(tuple[0]));
      setWriteSpeedMaxInputStr(String(tuple[1]));
    },
    [writeSpeedRange]
  );
  const handleChangeWriteSpeedMinInput = useCallback((str: string) => setWriteSpeedMinInputStr(str), []);
  const handleChangeWriteSpeedMaxInput = useCallback((str: string) => setWriteSpeedMaxInputStr(str), []);

  const handleChangeColor = (value: string) => {
    const values = colors.includes(value)
      ? colors.filter((item) => item !== value)
      : [...colors, value];
    handleChangeSearchParams("colors", JSON.stringify(values));
  };

  const handleChangeBrand = useCallback(
    (value: string) => {
      const nextBrands = brands.includes(value)
        ? brands.filter((item) => item !== value)
        : [...brands, value];
      navigateWithFilterState(nextBrands, capacity, "brand");
    },
    [brands, capacity, navigateWithFilterState]
  );

  const handleChangeSales = (value: string) => {
    const values = sales.includes(value)
      ? sales.filter((item) => item !== value)
      : [...sales, value];
    handleChangeSearchParams("sales", JSON.stringify(values));
  };

  /** Generic: selected values for a filter slug (from URL). */
  const getSelectedValues = useCallback(
    (slug: string): string[] => {
      const key = getParamKeyForSlug(slug);
      const param = getParam(searchParams, seoFilter?.params ?? null, key);
      return param ? param.split(",").map((s) => s.trim()).filter(Boolean) : [];
    },
    [searchParams, seoFilter?.params]
  );

  /** Generic: toggle one filter value; updates URL and resets page. */
  const handleFilterChange = useCallback(
    (slug: string, value: string, checked: boolean) => {
      const paramKey = getParamKeyForSlug(slug);
      const normalized = slug === "brand" ? normalizeBrandValue(value) : value;
      const current = getSelectedValues(slug);
      const next = checked
        ? [...current.filter((x) => x !== normalized), normalized]
        : current.filter((x) => x !== normalized);
      const params = new URLSearchParams(searchParams);
      params.delete("page");
      if (next.length > 0) params.set(paramKey, next.join(","));
      else params.delete(paramKey);
      const query = params.toString();
      const newUrl = query ? `${pathname}?${query}` : pathname;
      pushUrlAndRefresh(newUrl, slug);
    },
    [getSelectedValues, pathname, pushUrlAndRefresh, searchParams]
  );

  const handleAttributeRangeFilterChange = useCallback(
    (slug: string, value: string) => {
      const params = new URLSearchParams(searchParams);
      params.delete("page");
      params.set(slug, value);
      const query = params.toString();
      pushUrlAndRefresh(query ? `${pathname}?${query}` : pathname, slug);
    },
    [pathname, pushUrlAndRefresh, searchParams]
  );

  return {
    pendingFilterKey,
    pushUrlAndRefresh,
    navigateWithFilterState,
    sales,
    brands,
    rating,
    colors,
    prices,
    priceMinInputStr,
    priceMaxInputStr,
    handleChangePriceMinInput,
    handleChangePriceMaxInput,
    localCapacity,
    localRpm,
    localBuffer,
    capacityMinInputStr,
    capacityMaxInputStr,
    rpmMinInputStr,
    rpmMaxInputStr,
    bufferMinInputStr,
    bufferMaxInputStr,
    handleChangeCapacityMinInput,
    handleChangeCapacityMaxInput,
    handleChangeRpmMinInput,
    handleChangeRpmMaxInput,
    handleChangeBufferMinInput,
    handleChangeBufferMaxInput,
    capacity,
    rpm,
    buffer,
    sizeSelections,
    connectionSelections,
    collapsed,
    setCollapsed,
    handleChangePrice,
    applyPrice,
    applyPriceWithValues,
    debouncedApplyPriceWithValues,
    debouncedApplyCapacity,
    debouncedApplyRpm,
    debouncedApplyBuffer,
    handleChangeColor,
    handleChangeBrand,
    handleChangeSales,
    handleChangeSearchParams,
    priceRange,
    capacityRange,
    rpmRange,
    bufferRange,
    readSpeedRange,
    writeSpeedRange,
    localReadSpeed,
    localWriteSpeed,
    readSpeedMinInputStr,
    readSpeedMaxInputStr,
    writeSpeedMinInputStr,
    writeSpeedMaxInputStr,
    handleChangeReadSpeedMinInput,
    handleChangeReadSpeedMaxInput,
    handleChangeWriteSpeedMinInput,
    handleChangeWriteSpeedMaxInput,
    debouncedApplyReadSpeed,
    debouncedApplyWriteSpeed,
    handleChangeCapacity,
    handleChangeRpm,
    handleChangeBuffer,
    handleChangeReadSpeed,
    handleChangeWriteSpeed,
    applyCapacity,
    applyRpm,
    applyBuffer,
    applyReadSpeed,
    applyWriteSpeed,
    handleChangeSize,
    handleChangeConnection,
    pcieGenerationSelections,
    heatsinkSelections,
    handleChangePcieGeneration,
    handleChangeHeatsink,
    basePathForParams,
    hasSeoFilterInPath: Boolean(seoFilter),
    getSelectedValues,
    handleFilterChange,
    handleAttributeRangeFilterChange
  };
}
