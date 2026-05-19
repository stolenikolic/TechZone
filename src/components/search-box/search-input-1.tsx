"use client";

import { ChangeEvent, KeyboardEvent, Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
// MUI
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
// CUSTOM ICON COMPONENT
import Search from "icons/Search";
// CUSTOM DATA MODEL
import { CategoryLink } from "models/Layout.model";

const SEARCH_PAGE = "/products/search";
/** Stable id avoids MUI/React useId mismatch between SSR and client hydration. */
const SEARCH_INPUT_ID = "shop-header-search";

const INPUT_SLOT_PROPS = {
  sx: {
    border: 0,
    padding: 0,
    borderRadius: 1,
    borderColor: "transparent",
    overflow: "hidden",
    backgroundColor: "grey.50",
    "& .MuiOutlinedInput-notchedOutline": {
      border: 1,
      borderRadius: 1,
      borderColor: "transparent"
    }
  },
  endAdornment: (
    <Box
      ml={2}
      px={2}
      display="grid"
      alignItems="center"
      justifyContent="center"
      borderLeft="1px solid"
      borderColor="grey.200"
    >
      <Search sx={{ fontSize: 17, color: "grey.400" }} />
    </Box>
  )
};

function SearchInput1Placeholder() {
  return (
    <Box
      aria-hidden
      sx={{
        width: "100%",
        height: 40,
        borderRadius: 1,
        bgcolor: "grey.50"
      }}
    />
  );
}

function SearchInput1Field() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (pathname === SEARCH_PAGE) {
      setSearch(searchParams.get("q") ?? "");
    } else {
      setSearch("");
    }
  }, [pathname, searchParams]);

  const handleSearch = useCallback(() => {
    if (search.trim()) {
      const params = new URLSearchParams();
      params.set("q", search.trim());
      params.set("page", "1");
      router.push(`${SEARCH_PAGE}?${params.toString()}`);
    }
  }, [search, router]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  const handleEnter = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearch();
    }
  };

  return (
    <TextField
      id={SEARCH_INPUT_ID}
      name="q"
      fullWidth
      value={search}
      variant="outlined"
      onKeyDown={handleEnter}
      onChange={handleChange}
      placeholder="Searching for..."
      slotProps={{ input: INPUT_SLOT_PROPS }}
      aria-label="Search products"
      role="searchbox"
    />
  );
}

// ==============================================================
interface Props {
  categories: CategoryLink[];
}
// ==============================================================

export function SearchInput1({ categories }: Props) {
  if (!categories?.length) return null;

  return (
    <Suspense fallback={<SearchInput1Placeholder />}>
      <SearchInput1Field />
    </Suspense>
  );
}
