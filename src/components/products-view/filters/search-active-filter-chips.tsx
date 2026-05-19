"use client";

import type { SearchPageFilters } from "models/Filters";
import ActiveFilterChips from "./active-filter-chips";
import useSearchFilterParams from "./use-search-filter-params";

interface Props {
  filters: SearchPageFilters;
}

export default function SearchActiveFilterChips({ filters }: Props) {
  const { chips, removeChip, clearAllFilters } = useSearchFilterParams(filters);

  return <ActiveFilterChips chips={chips} onRemove={removeChip} onClearAll={clearAllFilters} />;
}
