"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
// MUI
import MuiPagination from "@mui/material/Pagination";
import { styled } from "@mui/material/styles";

// STYLED COMPONENT
export const StyledPagination = styled(MuiPagination)({
  display: "flex",
  marginTop: "2.5rem",
  justifyContent: "center"
});

// ==============================================================
type Props = { count: number };
// ==============================================================

export default function Pagination({ count }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const handlePageChange = useCallback(
    (_: unknown, page: number) => {
      const searchParams = new URLSearchParams();

      if (page === 1) {
        searchParams.delete("page");
      } else {
        searchParams.set("page", page.toString());
      }

      router.push(`${pathname}?${searchParams.toString()}`);
    },
    [router, pathname]
  );

  if (count <= 1) return null;

  return <StyledPagination color="primary" count={count} onChange={handlePageChange} />;
}
