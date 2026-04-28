"use client";

import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Add from "@mui/icons-material/Add";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import FlexBetween from "components/flex-box/flex-between";
// LOCAL CUSTOM COMPONENT
import SellerPackageCard from "../package-card";
// CUSTOM DUMMY DATA
import { PACKAGES } from "../packages";

export default function SellerPackagePageView() {
  return (
    <div className="pt-2 pb-2">
      <FlexBetween mb={2}>
        <Typography variant="h3">Seller Packages</Typography>

        <Button color="info" variant="contained" startIcon={<Add />}>
          Add New Package
        </Button>
      </FlexBetween>

      <Grid container spacing={3}>
        {PACKAGES.map((item) => (
          <Grid size={{ xl: 4, md: 6, xs: 12 }} key={item.id}>
            <SellerPackageCard listItem={item} />
          </Grid>
        ))}
      </Grid>
    </div>
  );
}
