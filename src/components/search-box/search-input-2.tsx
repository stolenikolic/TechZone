"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
// MUI
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
// STYLED COMPONENT
import { SearchOutlinedIcon } from "./styles";

const SEARCH_PAGE = "/products/search";

export function SearchInput2() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");

  // Sync input with URL: on search page show current q; on other pages show empty
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

  const INPUT_PROPS = {
    sx: {
      border: 0,
      height: 44,
      paddingRight: 0,
      overflow: "hidden",
      backgroundColor: "grey.50",
      "& .MuiOutlinedInput-notchedOutline": { border: 0 }
    },
    endAdornment: (
      <Button
        color="primary"
        disableElevation
        variant="contained"
        onClick={handleSearch}
        sx={{ px: "3rem", height: "100%", borderRadius: "0 4px 4px 0" }}
      >
        Search
      </Button>
    ),
    startAdornment: <SearchOutlinedIcon fontSize="small" />
  };

  return (
    <Box position="relative" flex="1 1 0" maxWidth={670} mx="auto">
      <TextField
        fullWidth
        variant="outlined"
        placeholder="Searching for..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        slotProps={{ input: INPUT_PROPS }}
      />
    </Box>
  );
}
