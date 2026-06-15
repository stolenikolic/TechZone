"use client";

import { Fragment, ReactNode, SyntheticEvent, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { styled, useTheme } from "@mui/material/styles";

const StyledTabs = styled(Tabs)(({ theme }) => ({
  minHeight: 0,
  marginTop: 80,
  marginBottom: 24,
  borderBottom: `1px solid ${theme.palette.divider}`,
  "& .inner-tab": {
    minHeight: 40,
    fontWeight: 500,
    textTransform: "capitalize"
  }
}));

type TabKey = "description" | "specifications" | "description-specs" | "faq" | "reviews";

type TabConfig = { key: TabKey; label: string };

// ==============================================================
interface Props {
  description: ReactNode;
  specifications?: ReactNode;
  faq?: ReactNode;
  reviews: ReactNode;
  hasSpecifications: boolean;
  hasFaq: boolean;
}
// ==============================================================

export default function ProductTabs({
  description,
  specifications,
  faq,
  reviews,
  hasSpecifications,
  hasFaq
}: Props) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [selectedOption, setSelectedOption] = useState(0);

  const tabs = useMemo<TabConfig[]>(() => {
    if (isDesktop) {
      return [
        {
          key: "description-specs",
          label: hasSpecifications ? "Opis i specifikacije" : "Opis"
        },
        ...(hasFaq ? [{ key: "faq" as const, label: "Često postavljana pitanja" }] : []),
        { key: "reviews", label: "Recenzije" }
      ];
    }

    return [
      { key: "description", label: "Opis" },
      ...(hasSpecifications ? [{ key: "specifications" as const, label: "Specifikacije" }] : []),
      ...(hasFaq ? [{ key: "faq" as const, label: "Često postavljana pitanja" }] : []),
      { key: "reviews", label: "Recenzije" }
    ];
  }, [hasFaq, hasSpecifications, isDesktop]);

  useEffect(() => {
    setSelectedOption(0);
  }, [isDesktop]);

  useEffect(() => {
    setSelectedOption((prev) => (prev < tabs.length ? prev : 0));
  }, [tabs.length]);

  const handleChangeTab = (_: SyntheticEvent, value: number) => setSelectedOption(value);

  const activeKey = tabs[selectedOption]?.key ?? "description";

  const renderContent = () => {
    switch (activeKey) {
      case "description-specs":
        return (
          <Box
            sx={{
              display: "flex",
              alignItems: "stretch",
              gap: 4
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>{description}</Box>
            {hasSpecifications && specifications ? (
              <>
                <Divider orientation="vertical" flexItem />
                <Box
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    justifyContent: "center"
                  }}
                >
                  <Box sx={{ width: "100%", maxWidth: 480 }}>
                    <Typography
                      variant="h6"
                      sx={{ mb: 2, fontWeight: 600, textAlign: "center" }}
                    >
                      Specifikacije
                    </Typography>
                    {specifications}
                  </Box>
                </Box>
              </>
            ) : null}
          </Box>
        );
      case "description":
        return description;
      case "specifications":
        return specifications;
      case "faq":
        return faq;
      case "reviews":
        return reviews;
      default:
        return null;
    }
  };

  return (
    <Fragment>
      <StyledTabs
        textColor="primary"
        value={selectedOption}
        indicatorColor="primary"
        onChange={handleChangeTab}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
      >
        {tabs.map((tab) => (
          <Tab key={tab.key} className="inner-tab" label={tab.label} />
        ))}
      </StyledTabs>

      <div className="mb-3">{renderContent()}</div>
    </Fragment>
  );
}
