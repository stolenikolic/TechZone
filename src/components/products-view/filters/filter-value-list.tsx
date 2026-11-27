"use client";

import { useState } from "react";
import type { SxProps, Theme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import FormGroup from "@mui/material/FormGroup";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Close from "@mui/icons-material/Close";
import Search from "@mui/icons-material/Search";
import FilterCheckboxRow from "./filter-checkbox-row";

/** Above this many values, the open filter shows a search field and scrolls. */
const SEARCH_THRESHOLD = 12;
const LIST_MAX_HEIGHT = 280;

export type FilterValueOption = {
  id: string;
  label: string;
  checked: boolean;
  onChange: () => void;
  pending?: boolean;
  /** Text used for search. Defaults to `label`. */
  searchText?: string;
};

type Props = {
  options: FilterValueOption[];
  searchPlaceholder?: string;
  sx?: SxProps<Theme>;
};

/** Strip case and diacritics so "samsung" matches "Samsung" and "š" matches "s". */
function foldSearch(value: string): string {
  return value
    .toLocaleLowerCase("bs")
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export default function FilterValueList({
  options,
  searchPlaceholder = "Pretraži",
  sx
}: Props) {
  const [query, setQuery] = useState("");

  const showSearch = options.length > SEARCH_THRESHOLD;
  const needle = foldSearch(query.trim());
  const queryActive = showSearch && needle.length > 0;

  let pinned: FilterValueOption[] = [];
  let visible = options;

  if (queryActive) {
    visible = options.filter((option) => foldSearch(option.searchText ?? option.label).includes(needle));
    const visibleIds = new Set(visible.map((option) => option.id));
    pinned = options.filter((option) => option.checked && !visibleIds.has(option.id));
  }

  return (
    <Box sx={sx}>
      {showSearch && (
        <TextField
          size="small"
          fullWidth
          value={query}
          placeholder={searchPlaceholder}
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
          sx={{ mb: 1 }}
          slotProps={{
            htmlInput: { "aria-label": searchPlaceholder },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: query ? (
                <InputAdornment position="end">
                  <IconButton size="small" aria-label="Obriši pretragu" onClick={() => setQuery("")}>
                    <Close fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : undefined
            }
          }}
        />
      )}

      <Box sx={showSearch ? { maxHeight: LIST_MAX_HEIGHT, overflowY: "auto" } : undefined}>
        {queryActive && pinned.length > 0 && (
          <Typography variant="caption" sx={{ color: "grey.600", display: "block", mb: 0.5 }}>
            Odabrano
          </Typography>
        )}

        <FormGroup>
          {pinned.map((option) => (
            <FilterCheckboxRow
              key={option.id}
              label={option.label}
              checked={option.checked}
              onChange={option.onChange}
              pending={option.pending}
            />
          ))}
          {visible.map((option) => (
            <FilterCheckboxRow
              key={option.id}
              label={option.label}
              checked={option.checked}
              onChange={option.onChange}
              pending={option.pending}
            />
          ))}
        </FormGroup>

        {queryActive && visible.length === 0 && (
          <Typography variant="body2" sx={{ py: 1, color: "grey.600" }}>
            Nema rezultata za „{query.trim()}“
          </Typography>
        )}
      </Box>
    </Box>
  );
}
