"use client";

import dynamic from "next/dynamic";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import { useTheme } from "@mui/material/styles";
// LOCAL CUSTOM COMPONENT
import Card2 from "./card-2";
// CHART OPTIONS
import * as options from "../chart-options";
// CUSTOM UTILS LIBRARY FUNCTION
import { currency } from "lib";

const ApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton animation="wave" height={100} width={120} />
});

// weekly chart series
const series = [{ name: "Weekly", data: [7600, 8500, 10100, 9800, 8700, 1050, 9100] }];
const totalOrderSeries = [{ name: "Weekly", data: [7600, 8500, 10100, 9800, 8700, 1050, 9100] }];

export default function Sales() {
  const theme = useTheme();

  return (
    <div>
      <Grid container spacing={3}>
        {/* WEEKLY SALE CHART */}
        <Grid size={{ lg: 3, md: 6, xs: 12 }}>
          <Card2 title="Weekly Sales" percentage="25.25%" amount={currency(10240, 0)}>
            <ApexChart
              type="bar"
              width={150}
              height={130}
              series={series}
              options={options.weeklyChartOptions(theme)}
            />
          </Card2>
        </Grid>

        {/* PRODUCT SHARE CHART */}
        <Grid size={{ lg: 3, md: 6, xs: 12 }}>
          <Card2 title="Product Share" percentage="10.25%" amount="39.56%">
            <ApexChart
              width={140}
              height={200}
              series={[75]}
              type="radialBar"
              options={options.productShareChartOptions(theme)}
            />
          </Card2>
        </Grid>

        {/* TOTAL ORDERS CHART */}
        <Grid size={{ lg: 3, md: 6, xs: 12 }}>
          <Card2 title="Total Order" percentage="2.65%" amount={currency(12260, 0)}>
            <ApexChart
              type="area"
              width={150}
              height={130}
              series={totalOrderSeries}
              options={options.totalOrderChartOptions(theme)}
            />
          </Card2>
        </Grid>

        {/* MARKET SHARE CHART */}
        <Grid size={{ lg: 3, md: 6, xs: 12 }}>
          <Card2 title="Market Share" percentage="2.65%" amount={currency(14260, 0)}>
            <ApexChart
              height={300}
              width={140}
              type="radialBar"
              series={[44, 55, 67]}
              options={options.marketShareChartOptions(theme)}
            />
          </Card2>
        </Grid>
      </Grid>
    </div>
  );
}
