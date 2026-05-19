"use client";

import { Fragment, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Collapse from "@mui/material/Collapse";
import FormGroup from "@mui/material/FormGroup";
import KeyboardArrowUp from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import AccordionHeader from "components/accordion";
import type { SearchPageFilters } from "models/Filters";
import CheckboxLabel from "./checkbox-label";
import DualRangeSlider from "./dual-range-slider";
import FilterSectionTitle from "./filter-section-title";
import SearchCategoryFilter from "./search-category-filter";
import useProductFilterCard from "./use-product-filter-card";

const BRAND_VISIBLE_LIMIT = 5;

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
  const [expandedBrands, setExpandedBrands] = useState(false);

  const hook = useProductFilterCard(filters);
  const { pendingFilterKey, debouncedApplyPriceWithValues, getSelectedValues, handleFilterChange } = hook;

  const priceRange = filters.priceRange;
  const brandFilter = filters.filters.find((item) => item.slug === "brand");
  const visibleBrands = brandFilter?.values.slice(0, BRAND_VISIBLE_LIMIT) ?? [];
  const hiddenBrands = brandFilter?.values.slice(BRAND_VISIBLE_LIMIT) ?? [];
  const hasHiddenBrands = (brandFilter?.values.length ?? 0) > BRAND_VISIBLE_LIMIT;

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
          <FilterSectionTitle title="Price Range" loading={pendingFilterKey === "prices"} sx={{ mb: 2 }} />
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
            <FilterSectionTitle title={brandFilter.name} loading={pendingFilterKey === "brand"} />
          </AccordionHeader>

          <Collapse in={openBrand}>
            <FormGroup>
              {visibleBrands.map((value) => {
                const selected = getSelectedValues("brand").includes(normalizeBrandValue(value));
                return (
                  <CheckboxLabel
                    key={value}
                    label={value}
                    checked={selected}
                    onChange={() => handleFilterChange("brand", value, !selected)}
                  />
                );
              })}
            </FormGroup>

            {hasHiddenBrands && (
              <>
                <Collapse in={expandedBrands} timeout="auto" unmountOnExit>
                  <FormGroup>
                    {hiddenBrands.map((value) => {
                      const selected = getSelectedValues("brand").includes(normalizeBrandValue(value));
                      return (
                        <CheckboxLabel
                          key={value}
                          label={value}
                          checked={selected}
                          onChange={() => handleFilterChange("brand", value, !selected)}
                        />
                      );
                    })}
                  </FormGroup>
                </Collapse>

                <Button
                  size="small"
                  color="primary"
                  variant="text"
                  endIcon={
                    expandedBrands ? (
                      <KeyboardArrowUp fontSize="small" />
                    ) : (
                      <KeyboardArrowDown fontSize="small" />
                    )
                  }
                  onClick={() => setExpandedBrands((state) => !state)}
                  sx={{ mt: 1, px: 0, minWidth: 0, color: "primary.main" }}
                >
                  {expandedBrands ? "Prikaži manje" : "Prikaži više"}
                </Button>
              </>
            )}
          </Collapse>
        </Fragment>
      )}
    </div>
  );
}
