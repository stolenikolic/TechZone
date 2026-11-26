"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Search from "icons/Search";

const SEARCH_PAGE = "/pretraga";
const SEARCH_INPUT_ID = "shop-mobile-header-search";

const INPUT_SLOT_PROPS = {
  sx: {
    height: 40,
    padding: 0,
    borderRadius: 1,
    overflow: "hidden",
    backgroundColor: "grey.50",
    "& .MuiOutlinedInput-notchedOutline": {
      border: 1,
      borderRadius: 1,
      borderColor: "transparent"
    },
    "& .MuiOutlinedInput-input": { paddingLeft: "14px" }
  },
  endAdornment: (
    <Box
      component="button"
      type="submit"
      aria-label="Pretraži"
      sx={{
        ml: 2,
        px: 2,
        height: "100%",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        color: "grey.400",
        bgcolor: "transparent",
        border: 0,
        borderLeft: "1px solid",
        borderColor: "grey.200",
        "&:hover": { color: "grey.600" }
      }}
    >
      <Search sx={{ fontSize: 17 }} />
    </Box>
  )
};

function MobileHeaderSearchPlaceholder() {
  return <Box aria-hidden sx={{ width: "100%", height: 40, borderRadius: 1, bgcolor: "grey.50" }} />;
}

function MobileHeaderSearchField() {
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
    const query = search.trim();
    if (!query) return;

    const params = new URLSearchParams();
    params.set("q", query);
    params.set("page", "1");
    router.push(`${SEARCH_PAGE}?${params.toString()}`);
  }, [search, router]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSearch();
  };

  return (
    <Box component="form" role="search" onSubmit={handleSubmit} width="100%">
      <TextField
        id={SEARCH_INPUT_ID}
        name="q"
        fullWidth
        value={search}
        variant="outlined"
        placeholder="Pretraži proizvode..."
        onChange={(event) => setSearch(event.target.value)}
        slotProps={{
          input: INPUT_SLOT_PROPS,
          htmlInput: { enterKeyHint: "search", "aria-label": "Pretraga proizvoda" }
        }}
      />
    </Box>
  );
}

export function MobileHeaderSearch() {
  return (
    <Suspense fallback={<MobileHeaderSearchPlaceholder />}>
      <MobileHeaderSearchField />
    </Suspense>
  );
}
