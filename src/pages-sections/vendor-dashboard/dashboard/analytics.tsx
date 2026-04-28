"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
// MUI
import Card from "@mui/material/Card";
import Skeleton from "@mui/material/Skeleton";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { styled, useTheme } from "@mui/material/styles";
import Select from "@mui/material/Select";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
// GLOBAL CUSTOM COMPONENTS
import FlexBetween from "components/flex-box/flex-between";
// CHART OPTIONS
import { analyticsChartOptions } from "./chart-options";

const ApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton animation="wave" height={300} />
});

const categories = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

// STYLED COMPONENT
const StyledSelect = styled(Select)(({ theme }) => ({
  fontSize: 14,
  fontWeight: 500,
  color: theme.palette.grey[600],
  "& fieldset": { border: "0 !important" },
  "& .MuiSelect-select": { padding: 0, paddingRight: "8px !important" }
}));

const series = [
  {
    name: "Sales",
    data: [15000, 45000, 12000, 50000, 75000, 33000, 30000, 99000, 75000, 90000, 55000, 15000]
  },
  {
    name: "Expense",
    data: [11500, 48000, 19000, 59000, 25000, 39000, 36000, 49000, 79000, 70000, 57000, 15000]
  }
];

export default function Analytics() {
  const theme = useTheme();
  const [selectType, setSelectType] = useState("yearly");

  return (
    <Card sx={{ p: 3 }}>
      <FlexBetween>
        <Typography variant="h5">Analytics</Typography>

        <StyledSelect
          value={selectType}
          IconComponent={() => <KeyboardArrowDown />}
          onChange={(e) => setSelectType(e.target.value as string)}
        >
          <MenuItem value="yearly">Yearly</MenuItem>
          <MenuItem value="monthly">Monthly</MenuItem>
          <MenuItem value="Weekly">Weekly</MenuItem>
        </StyledSelect>
      </FlexBetween>

      <ApexChart
        type="bar"
        height={300}
        series={series}
        options={analyticsChartOptions(theme, categories)}
      />
    </Card>
  );
}
