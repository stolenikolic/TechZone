"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Card from "@mui/material/Card";
import TabList from "@mui/lab/TabList";
import TabPanel from "@mui/lab/TabPanel";
import TabContext from "@mui/lab/TabContext";
import { styled } from "@mui/material/styles";
import ZoneBlockEditor from "../zone-block-editor";

const StyledTabPanel = styled(TabPanel)({
  paddingLeft: 0,
  paddingRight: 0,
  paddingBottom: 0
});

const StyledTabList = styled(TabList)(({ theme }) => ({
  "& .MuiTab-root.Mui-selected": { color: theme.palette.info.main },
  "& .MuiTabs-indicator": { background: theme.palette.info.main }
}));

export default function HomepageSettingsPageView() {
  const [tab, setTab] = useState("hero_carousel");

  return (
    <Box py={4}>
      <Card sx={{ px: 3, py: 2 }}>
        <TabContext value={tab}>
          <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            <StyledTabList onChange={(_, value) => setTab(value)} variant="scrollable">
              <Tab label="Hero slider" value="hero_carousel" disableRipple />
              <Tab label="Side banners" value="hero_side" disableRipple />
              <Tab label="Promo cards" value="promo" disableRipple />
            </StyledTabList>
          </Box>

          <StyledTabPanel value="hero_carousel">
            <ZoneBlockEditor
              zone="hero_carousel"
              title="Hero carousel"
              description="Large slides on the left side of the homepage hero."
            />
          </StyledTabPanel>

          <StyledTabPanel value="hero_side">
            <ZoneBlockEditor
              zone="hero_side"
              title="Side banners"
              description="Two smaller banners on the right side of the hero."
            />
          </StyledTabPanel>

          <StyledTabPanel value="promo">
            <ZoneBlockEditor
              zone="promo"
              title="Promo cards"
              description="Two wide promotional cards below the product carousels."
            />
          </StyledTabPanel>
        </TabContext>
      </Card>
    </Box>
  );
}
