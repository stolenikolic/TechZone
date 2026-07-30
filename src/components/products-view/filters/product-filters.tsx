"use client";

import { Fragment, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
// MUI
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Collapse from "@mui/material/Collapse";
import FormGroup from "@mui/material/FormGroup";
import Typography from "@mui/material/Typography";
import KeyboardArrowUp from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
// GLOBAL CUSTOM COMPONENTS
import AccordionHeader from "components/accordion";
import { NavLink } from "components/nav-link";
// LOCAL CUSTOM COMPONENTS
import FilterCheckboxRow from "./filter-checkbox-row";
import DualRangeSlider, { formatRangeParam } from "./dual-range-slider";
import FilterSectionTitle from "./filter-section-title";
// CUSTOM LOCAL HOOK
import useProductFilterCard, { type ProductFilterCardFilters } from "./use-product-filter-card";
// TYPES
import type { CategorySidebarFilters, FilterItem } from "models/Filters";
import { isSearchPageFilters } from "models/Filters";
import SearchPageSidebar from "./search-page-sidebar";

function isCategorySidebarFilters(f: ProductFilterCardFilters): f is CategorySidebarFilters {
  return "filters" in f && Array.isArray((f as CategorySidebarFilters).filters);
}

/** Normalize brand value for URL comparison (display "WD" -> param "wd"). */
function normalizeBrandValue(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-");
}

function getCategoryChildTitle(child: string | { title: string; href: string }) {
  return typeof child === "string" ? child : child.title;
}

function getCategoryChildHref(child: string | { title: string; href: string }) {
  return typeof child === "string" ? undefined : child.href;
}

/** True when pathname is under this parent's /categories/{slug} (from any child href). */
function isCategoryActiveFromChildren(
  children: Array<string | { title: string; href: string }>,
  pathname: string
) {
  return children.some((child) => {
    const href = getCategoryChildHref(child);
    if (!href) return false;
    const parts = href.split("/").filter(Boolean);
    if (parts.length < 2) return false;
    const parentPath = `/${parts[0]}/${parts[1]}`;
    return pathname === parentPath || pathname.startsWith(`${parentPath}/`);
  });
}

function formatFilterValue(slug: string, value: string) {
  if (slug === "heatsink" && (value === "true" || value === "false")) {
    return value === "true" ? "Yes" : "No";
  }

  return value === "-" ? "N/A (SATA)" : value;
}

const BRAND_VISIBLE_LIMIT = 5;

/** Slightly tighter accordion rows; font/dividers unchanged. */
const FILTER_ACCORDION_HEADER_SX = {
  padding: "0.375rem 0",
  cursor: "pointer",
  color: "grey.600"
} as const;

interface RangeAttributeFilterProps {
  filter: FilterItem;
  selectedParam: string | null;
  onApply: (slug: string, value: string) => void;
}

function RangeAttributeFilter({ filter, selectedParam, onApply }: RangeAttributeFilterProps) {
  const range = filter.range;
  if (!range) return null;

  return (
    <DualRangeSlider
      rangeMin={range.min}
      rangeMax={range.max}
      step={filter.step ?? 1}
      unit={filter.unit}
      selectedParam={selectedParam}
      onCommit={(tuple) => onApply(filter.slug, formatRangeParam(tuple))}
    />
  );
}

export default function ProductFilters({ filters }: { filters: ProductFilterCardFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openFilterSlugs, setOpenFilterSlugs] = useState<Record<string, boolean>>({ brand: true });
  const [expandedFilterSlugs, setExpandedFilterSlugs] = useState<Record<string, boolean>>({});
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => {
    if (!isCategorySidebarFilters(filters)) return {};
    const initial: Record<string, boolean> = {};
    for (const item of filters.categories) {
      if (!item.children) continue;
      initial[item.title] = isCategoryActiveFromChildren(item.children, pathname);
    }
    return initial;
  });

  const {
    debouncedApplyPriceWithValues,
    basePathForParams,
    hasSeoFilterInPath,
    getSelectedValues,
    getFilterQueryParam,
    handleFilterChange,
    handleAttributeRangeFilterChange,
    isFilterPending,
    isSectionPending,
    filterValuePendingKey,
    priceRange
  } = useProductFilterCard(filters);

  const activeFilterKeys = Array.from(searchParams.keys()).filter((key) => key !== "page");
  const hasActiveFilters = activeFilterKeys.length > 0 || hasSeoFilterInPath;

  const handleClearFilters = () => {
    const targetPath = hasSeoFilterInPath ? basePathForParams : pathname;
    router.push(targetPath);
  };

  /** Search page: category facets from current query only */
  if (isSearchPageFilters(filters)) {
    return (
      <div>
        <SearchPageSidebar filters={filters} />
      </div>
    );
  }

  /** Dynamic sidebar: API-driven filters array + price + categories */
  if (isCategorySidebarFilters(filters)) {
    const CATEGORIES = filters.categories;
    return (
      <div>
        <Typography variant="h6" sx={{ mb: 1.25 }}>
          Categories
        </Typography>
        {CATEGORIES.map((item) =>
          item.children ? (
            <Fragment key={item.title}>
              <AccordionHeader
                open={!!openCategories[item.title]}
                onClick={() =>
                  setOpenCategories((prev) => {
                    const nextOpen = !prev[item.title];
                    const next: Record<string, boolean> = {};
                    for (const cat of CATEGORIES) {
                      if (cat.children) next[cat.title] = cat.title === item.title ? nextOpen : false;
                    }
                    return next;
                  })
                }
                sx={FILTER_ACCORDION_HEADER_SX}
              >
                <Typography component="span">{item.title}</Typography>
              </AccordionHeader>
              <Collapse in={!!openCategories[item.title]}>
                {item.children.map((child) => {
                  const title = getCategoryChildTitle(child);
                  const href = getCategoryChildHref(child);

                  const content = (
                    <Typography
                      variant="body1"
                      sx={{ py: 0.75, pl: "22px", fontSize: 14, cursor: "pointer", color: "grey.600" }}
                    >
                      {title}
                    </Typography>
                  );

                  return href ? (
                    <NavLink href={href} key={title}>
                      {content}
                    </NavLink>
                  ) : (
                    <Fragment key={title}>{content}</Fragment>
                  );
                })}
              </Collapse>
            </Fragment>
          ) : (
            <Typography
              variant="body1"
              key={item.title}
              sx={{ py: 0.75, fontSize: 14, cursor: "pointer", color: "grey.600" }}
            >
              {item.title}
            </Typography>
          )
        )}
        <Box component={Divider} my={3} />
        {priceRange && (
          <>
            <FilterSectionTitle title="Price Range" loading={isSectionPending("prices")} sx={{ mb: 2 }} />
            <DualRangeSlider
              rangeMin={priceRange.min}
              rangeMax={priceRange.max}
              selectedParam={getFilterQueryParam("prices")}
              onCommit={(tuple) => debouncedApplyPriceWithValues(tuple)}
            />
            <Box component={Divider} my={3} />
          </>
        )}
        {filters.filters.map((filter) => {
          const isBrand = filter.slug === "brand";
          const open = openFilterSlugs[filter.slug] ?? isBrand;
          const expanded = expandedFilterSlugs[filter.slug] ?? false;
          const visibleValues = isBrand ? filter.values.slice(0, BRAND_VISIBLE_LIMIT) : filter.values;
          const hiddenValues = isBrand ? filter.values.slice(BRAND_VISIBLE_LIMIT) : [];
          const hasHiddenBrandValues = isBrand && filter.values.length > BRAND_VISIBLE_LIMIT;
          const isRangeFilter = filter.displayType === "range" && filter.range;

          return (
            <Fragment key={filter.slug}>
              <AccordionHeader
                open={open}
                onClick={() => setOpenFilterSlugs((state) => ({ ...state, [filter.slug]: !open }))}
                sx={FILTER_ACCORDION_HEADER_SX}
              >
                <FilterSectionTitle title={filter.name} loading={isSectionPending(filter.slug)} />
              </AccordionHeader>

              <Collapse in={open}>
                {isRangeFilter ? (
                  <RangeAttributeFilter
                    filter={filter}
                    selectedParam={getFilterQueryParam(filter.slug)}
                    onApply={handleAttributeRangeFilterChange}
                  />
                ) : (
                  <>
                    <FormGroup>
                      {visibleValues.map((value) => {
                        const normalized = isBrand ? normalizeBrandValue(value) : value;
                        const selected = getSelectedValues(filter.slug).includes(normalized);
                        const pendingKey = filterValuePendingKey(filter.slug, normalized);

                        return (
                          <FilterCheckboxRow
                            key={value}
                            label={formatFilterValue(filter.slug, value)}
                            checked={selected}
                            onChange={() => handleFilterChange(filter.slug, value, !selected)}
                            pending={isFilterPending(pendingKey)}
                          />
                        );
                      })}
                    </FormGroup>

                    {hasHiddenBrandValues && (
                      <>
                        <Collapse in={expanded} timeout="auto" unmountOnExit>
                          <FormGroup>
                            {hiddenValues.map((value) => {
                              const normalized = normalizeBrandValue(value);
                              const selected = getSelectedValues(filter.slug).includes(normalized);
                              const pendingKey = filterValuePendingKey(filter.slug, normalized);

                              return (
                                <FilterCheckboxRow
                                  key={value}
                                  label={formatFilterValue(filter.slug, value)}
                                  checked={selected}
                                  onChange={() => handleFilterChange(filter.slug, value, !selected)}
                                  pending={isFilterPending(pendingKey)}
                                />
                              );
                            })}
                          </FormGroup>
                        </Collapse>

                        <Button
                          size="small"
                          color="primary"
                          variant="text"
                          endIcon={expanded ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                          onClick={() =>
                            setExpandedFilterSlugs((state) => ({ ...state, [filter.slug]: !expanded }))
                          }
                          sx={{ mt: 1, px: 0, minWidth: 0, color: "primary.main" }}
                        >
                          {expanded ? "Prikaži manje" : "Prikaži više"}
                        </Button>
                      </>
                    )}
                  </>
                )}
              </Collapse>
              <Box component={Divider} my={3} />
            </Fragment>
          );
        })}
        {hasActiveFilters && (
          <Button
            fullWidth
            disableElevation
            color="error"
            variant="contained"
            onClick={handleClearFilters}
            sx={{ mt: 4 }}
          >
            Clear all filters
          </Button>
        )}
      </div>
    );
  }

  return null;
}
