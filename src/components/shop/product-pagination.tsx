"use client";

import { memo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Pagination from "@mui/material/Pagination";
import Typography from "@mui/material/Typography";
import FlexBetween from "components/flex-box/flex-between";
import { renderProductCount } from "lib";

interface Props {
  page: number;
  perPage: number;
  totalProducts: number;
}

export default memo(function ProductPagination({ page, perPage, totalProducts }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChangePage = (_: unknown, nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage === 1) {
      params.delete("page");
    } else {
      params.set("page", nextPage.toString());
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <FlexBetween flexWrap="wrap" my={8}>
      <Typography fontWeight={500} variant="body1">
        {renderProductCount(page, perPage, totalProducts)}
      </Typography>

      <Pagination
        page={page}
        color="primary"
        variant="outlined"
        onChange={handleChangePage}
        count={Math.ceil(totalProducts / perPage)}
        aria-label="Navigacija stranica"
        getItemAriaLabel={(type, pageNumber, selected) => {
          if (type === "page") {
            return selected ? `Strana ${pageNumber}` : `Idi na stranu ${pageNumber}`;
          }
          if (type === "first") return "Idi na prvu stranu";
          if (type === "last") return "Idi na posljednju stranu";
          if (type === "next") return "Idi na sljedeću stranu";
          return "Idi na prethodnu stranu";
        }}
      />
    </FlexBetween>
  );
});
