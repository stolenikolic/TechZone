"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Tune from "@mui/icons-material/Tune";
import Sidenav from "components/side-nav";
import ProductFilters from "components/products-view/filters";
import type { ProductFilterCardFilters } from "components/products-view/filters/use-product-filter-card";

interface Props {
  filters: ProductFilterCardFilters;
}

export default function MobileFilterButton({ filters }: Props) {
  return (
    <Sidenav
      handler={(toggle) => (
        <Button
          variant="outlined"
          size="small"
          startIcon={<Tune fontSize="small" />}
          onClick={toggle}
        >
          Filtriraj
        </Button>
      )}
    >
      <Box px={3} py={2}>
        <ProductFilters filters={filters} />
      </Box>
    </Sidenav>
  );
}
