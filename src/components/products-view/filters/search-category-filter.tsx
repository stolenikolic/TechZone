"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormGroup from "@mui/material/FormGroup";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUp from "@mui/icons-material/KeyboardArrowUp";
import type { SearchCategoryFacet } from "lib/search/search-category-facets";
import type { SearchPageFilters } from "models/Filters";
import FilterCheckboxRow from "./filter-checkbox-row";
import FilterSectionTitle from "./filter-section-title";
import useSearchFilterParams from "./use-search-filter-params";

export const SEARCH_CATEGORY_VISIBLE_LIMIT = 8;

const CATEGORY_CHECKBOX_INDENT_SX = { pl: "22px" } as const;

interface Props {
  facets: SearchCategoryFacet[];
  filters: SearchPageFilters;
}

export default function SearchCategoryFilter({ facets, filters }: Props) {
  const { selectedCategorySlugs, toggleCategory, isFilterPending, filterValuePendingKey } =
    useSearchFilterParams(filters);
  const [expanded, setExpanded] = useState(false);

  if (facets.length === 0) return null;

  const visibleFacets = expanded ? facets : facets.slice(0, SEARCH_CATEGORY_VISIBLE_LIMIT);
  const hasHidden = facets.length > SEARCH_CATEGORY_VISIBLE_LIMIT;

  return (
    <Box>
      <FilterSectionTitle title="Filtriraj po kategoriji" sx={{ mb: 2 }} />

      <FormGroup sx={CATEGORY_CHECKBOX_INDENT_SX}>
        {visibleFacets.map((facet) => {
          const checked = selectedCategorySlugs.includes(facet.slug.toLowerCase());

          const slug = facet.slug.toLowerCase();
          return (
            <FilterCheckboxRow
              key={facet.slug}
              checked={checked}
              onChange={() => toggleCategory(facet.slug)}
              label={`${facet.name} (${facet.count})`}
              pending={isFilterPending(filterValuePendingKey("category", slug))}
            />
          );
        })}
      </FormGroup>

      {hasHidden && (
        <Button
          size="small"
          color="primary"
          variant="text"
          endIcon={expanded ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
          onClick={() => setExpanded((state) => !state)}
          sx={{ mt: 1, ml: "22px", px: 0, minWidth: 0, color: "primary.main" }}
        >
          {expanded ? "Prikaži manje" : `Prikaži sve (${facets.length})`}
        </Button>
      )}
    </Box>
  );
}
