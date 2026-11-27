"use client";

import { Fragment, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Collapse from "@mui/material/Collapse";
import AccordionHeader from "components/accordion";
import type { SearchPageFilters } from "models/Filters";
import DualRangeSlider from "./dual-range-slider";
import FilterSectionTitle from "./filter-section-title";
import FilterValueList from "./filter-value-list";
import SearchCategoryFilter from "./search-category-filter";
import useProductFilterCard from "./use-product-filter-card";

const FILTER_ACCORDION_HEADER_SX = {
  padding: "0.375rem 0",
  cursor: "pointer",
  color: "grey.600"
} as const;

function normalizeBrandValue(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-");
}

interface Props {
  filters: SearchPageFilters;
}

export default function SearchPageSidebar({ filters }: Props) {
  const searchParams = useSearchParams();
  const [openBrand, setOpenBrand] = useState(true);

  const hook = useProductFilterCard(filters);
  const {
    pendingFilterKey,
    isFilterPending,
    isSectionPending,
    filterValuePendingKey,
    debouncedApplyPriceWithValues,
    getSelectedValues,
    handleFilterChange
  } = hook;

  const priceRange = filters.priceRange;
  const brandFilter = filters.filters.find((item) => item.slug === "brand");

  return (
    <div>
      {filters.searchCategoryFacets.length > 0 && (
        <>
          <SearchCategoryFilter facets={filters.searchCategoryFacets} filters={filters} />
          <Box component={Divider} my={3} />
        </>
      )}

      {priceRange && (
        <>
          <FilterSectionTitle title="Raspon cijene" loading={pendingFilterKey === "prices"} sx={{ mb: 2 }} />
          <DualRangeSlider
            rangeMin={priceRange.min}
            rangeMax={priceRange.max}
            selectedParam={searchParams.get("prices")}
            onCommit={(tuple) => debouncedApplyPriceWithValues(tuple)}
          />
          <Box component={Divider} my={3} />
        </>
      )}

      {brandFilter && brandFilter.values.length > 0 && (
        <Fragment>
          <AccordionHeader
            open={openBrand}
            onClick={() => setOpenBrand((state) => !state)}
            sx={FILTER_ACCORDION_HEADER_SX}
          >
            <FilterSectionTitle title="Brend" loading={isSectionPending("brand")} />
          </AccordionHeader>

          <Collapse in={openBrand}>
            <FilterValueList
              searchPlaceholder="Pretraži brend"
              options={(brandFilter?.values ?? []).map((value) => {
                const norm = normalizeBrandValue(value);
                const selected = getSelectedValues("brand").includes(norm);
                return {
                  id: value,
                  label: value,
                  checked: selected,
                  pending: isFilterPending(filterValuePendingKey("brand", norm)),
                  onChange: () => handleFilterChange("brand", value, !selected)
                };
              })}
            />
          </Collapse>
        </Fragment>
      )}
    </div>
  );
}
