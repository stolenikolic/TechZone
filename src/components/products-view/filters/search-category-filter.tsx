"use client";

import Box from "@mui/material/Box";
import type { SearchCategoryFacet } from "lib/search/search-category-facets";
import type { SearchPageFilters } from "models/Filters";
import FilterSectionTitle from "./filter-section-title";
import FilterValueList from "./filter-value-list";
import useSearchFilterParams from "./use-search-filter-params";

const CATEGORY_CHECKBOX_INDENT_SX = { pl: "22px" } as const;

interface Props {
  facets: SearchCategoryFacet[];
  filters: SearchPageFilters;
}

export default function SearchCategoryFilter({ facets, filters }: Props) {
  const { selectedCategorySlugs, toggleCategory, isFilterPending, filterValuePendingKey } =
    useSearchFilterParams(filters);

  if (facets.length === 0) return null;

  return (
    <Box>
      <FilterSectionTitle title="Filtriraj po kategoriji" sx={{ mb: 2 }} />

      <FilterValueList
        sx={CATEGORY_CHECKBOX_INDENT_SX}
        searchPlaceholder="Pretraži kategoriju"
        options={facets.map((facet) => {
          const slug = facet.slug.toLowerCase();
          return {
            id: facet.slug,
            label: `${facet.name} (${facet.count})`,
            searchText: facet.name,
            checked: selectedCategorySlugs.includes(slug),
            pending: isFilterPending(filterValuePendingKey("category", slug)),
            onChange: () => toggleCategory(facet.slug)
          };
        })}
      />
    </Box>
  );
}
