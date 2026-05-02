interface Item {
  label: string;
  value: string;
}

export interface Category {
  title: string;
  children?: Array<string | { title: string; href: string }>;
}

export type RangeFilter = { min: number; max: number };

/** Single filter from API: slug, name, list of values. */
export type FilterItem = { slug: string; name: string; values: string[] };

/** API-driven sidebar: filters array + price range + category nav. No hardcoded attribute names. */
export type CategorySidebarFilters = {
  filters: FilterItem[];
  priceRange?: RangeFilter;
  categories: Category[];
};

export default interface Filters {
  brands: Item[];
  others: Item[];
  colors: string[];
  categories: Category[];
  /** Dynamic: only set when category has products with price. */
  priceRange?: RangeFilter;
  /** Dynamic: only set when category has products with capacity attribute. */
  capacityRange?: RangeFilter;
  /** Dynamic: only set when category has products with rpm attribute. */
  rpmRange?: RangeFilter;
  /** Dynamic: only set when category has products with buffer attribute. */
  bufferRange?: RangeFilter;
  /** Dynamic: only set when category has products with size_inch or size attribute. */
  sizeOptions?: string[];
  /** Dynamic: only set when category has products with connection attribute (e.g. SSD). */
  connectionOptions?: string[];
  /** Dynamic: SSD read speed range (MB/s). */
  readSpeedRange?: RangeFilter;
  /** Dynamic: SSD write speed range (MB/s). */
  writeSpeedRange?: RangeFilter;
  /** Dynamic: SSD PCIe generation options (e.g. "3", "4", "5", "-"). */
  pcieGenerationOptions?: string[];
  /** Dynamic: SSD heatsink options (e.g. "true", "false"). */
  heatsinkOptions?: string[];
}
