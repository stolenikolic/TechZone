"use client";

import { Fragment, ReactNode, SyntheticEvent, useState } from "react";
// MUI
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { styled } from "@mui/material/styles";

// STYLED COMPONENT
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

// ==============================================================
interface Props {
  description: ReactNode;
  /** Optional. When provided, a "Specifications" tab is shown between Description and Reviews. */
  specifications?: ReactNode;
  reviews: ReactNode;
}
// ==============================================================

export default function ProductTabs({ description, specifications, reviews }: Props) {
  const [selectedOption, setSelectedOption] = useState(0);
  const handleChangeTab = (_: SyntheticEvent, value: number) => setSelectedOption(value);

  const hasSpecifications = specifications != null;

  return (
    <Fragment>
      <StyledTabs
        textColor="primary"
        value={selectedOption}
        indicatorColor="primary"
        onChange={handleChangeTab}
      >
        <Tab className="inner-tab" label="Description" />
        {hasSpecifications && <Tab className="inner-tab" label="Specifications" />}
        <Tab className="inner-tab" label="Reviews" />
      </StyledTabs>

      <div className="mb-3">
        {selectedOption === 0 && description}
        {hasSpecifications && selectedOption === 1 && specifications}
        {selectedOption === (hasSpecifications ? 2 : 1) && reviews}
      </div>
    </Fragment>
  );
}
