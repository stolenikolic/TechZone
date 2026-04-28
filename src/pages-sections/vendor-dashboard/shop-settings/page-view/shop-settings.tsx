"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
// LOCAL CUSTOM COMPONENT
import SettingsForm from "../settings-form";
import PageSettings from "../page-settings";

export default function ShopSettingsPageView() {
  return (
    <Box py={4} maxWidth={740} margin="auto">
      <Typography variant="h3" sx={{ mb: 2 }}>
        Shop Settings
      </Typography>

      <Card sx={{ p: 3 }}>
        {/* BASIC SETTING SECTION */}
        <Typography variant="h6" sx={{ mb: 3 }}>
          Basic Settings
        </Typography>

        <SettingsForm />

        <Divider sx={{ my: 4 }} />

        {/* SHOP SETTING SECTION */}
        <Typography variant="h6" sx={{ mb: 2 }}>
          Shop Page Settings
        </Typography>

        <PageSettings />

        <Button color="info" variant="contained">
          Save Changes
        </Button>
      </Card>
    </Box>
  );
}
