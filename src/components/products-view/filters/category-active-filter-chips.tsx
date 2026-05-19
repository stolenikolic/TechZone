"use client";

import type { CategorySidebarFilters } from "models/Filters";
import ActiveFilterChips from "./active-filter-chips";
import useCategoryFilterChips from "./use-category-filter-chips";

interface Props {
  filters: CategorySidebarFilters;
}

export default function CategoryActiveFilterChips({ filters }: Props) {
  const { chips, removeChip, clearAllFilters } = useCategoryFilterChips(filters);

  return <ActiveFilterChips chips={chips} onRemove={removeChip} onClearAll={clearAllFilters} />;
}
