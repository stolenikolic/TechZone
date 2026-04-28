import type { Theme } from "@mui/material/styles";
import type { ApexOptions } from "apexcharts";

export const weeklyChartOptions = (theme: Theme): ApexOptions => ({
  grid: { show: false },
  chart: {
    background: "transparent",
    toolbar: { show: false },
    fontFamily: theme.typography.fontFamily
  },
  colors: [theme.palette.info.main],
  dataLabels: { enabled: false },
  states: {
    active: { filter: { type: "none" } },
    hover: { filter: { type: "none" } }
  },
  theme: { mode: theme.palette.mode },
  xaxis: {
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: {
      show: false,
      style: {
        fontWeight: 500,
        colors: theme.palette.text.secondary
      }
    }
  },
  yaxis: {
    min: 0,
    max: 10000,
    show: false,
    tickAmount: 4,
    labels: {
      style: {
        fontWeight: 500,
        colors: theme.palette.text.secondary
      }
    }
  },
  tooltip: {
    enabled: false,
    x: { show: false },
    y: { formatter: (val: number) => `$${val}` }
  },
  plotOptions: {
    bar: {
      columnWidth: "50%",
      borderRadius: 5,
      borderRadiusApplication: "end"
    }
  }
});

export const productShareChartOptions = (theme: Theme): ApexOptions => ({
  chart: { background: "transparent", width: "100%" },
  colors: [theme.palette.info.main],
  plotOptions: {
    radialBar: {
      hollow: { margin: 0 },
      dataLabels: {
        name: { show: false },
        value: {
          offsetY: 6,
          fontSize: "14px",
          fontWeight: "600",
          fontFamily: theme.typography.fontFamily
        }
      }
    }
  },
  labels: ["Target"],
  theme: { mode: theme.palette.mode },
  states: { hover: { filter: { type: "none" } } }
});

export const totalOrderChartOptions = (theme: Theme): ApexOptions => ({
  grid: { show: false },
  chart: {
    background: "transparent",
    toolbar: { show: false },
    fontFamily: theme.typography.fontFamily
  },
  colors: [theme.palette.info.main],
  dataLabels: { enabled: false },
  states: {
    active: { filter: { type: "none" } },
    hover: { filter: { type: "none" } }
  },
  theme: { mode: theme.palette.mode },
  xaxis: {
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: {
      show: false,
      style: { fontWeight: 500, colors: theme.palette.text.secondary }
    }
  },
  yaxis: {
    min: 0,
    max: 10000,
    show: false,
    tickAmount: 4,
    labels: {
      style: { fontWeight: 500, colors: theme.palette.text.secondary }
    }
  },
  tooltip: {
    enabled: false,
    x: { show: false },
    y: { formatter: (val: number) => `$${val}` }
  },
  plotOptions: {
    bar: { columnWidth: "50%", borderRadius: 5 }
  }
});

export const marketShareChartOptions = (theme: Theme): ApexOptions => ({
  chart: { background: "transparent", fontFamily: theme.typography.fontFamily },
  colors: [theme.palette.info.main, theme.palette.warning.main, theme.palette.primary.main],
  plotOptions: {
    radialBar: {
      hollow: { size: "30%", margin: 0 },
      dataLabels: {
        name: { show: false },
        value: { offsetY: 6, fontSize: "14px", fontWeight: "600" },
        total: {
          show: true,
          fontSize: "14px",
          fontWeight: "600",
          formatter: function (w) {
            return w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
          }
        }
      }
    }
  },
  labels: ["Samsung", "Symphony", "Iphone"],
  theme: { mode: theme.palette.mode },
  states: { hover: { filter: { type: "none" } } }
});

export const analyticsChartOptions = (theme: Theme, categories: string[]): ApexOptions => ({
  chart: {
    background: "transparent",
    toolbar: { show: false },
    fontFamily: theme.typography.fontFamily
  },
  colors: [theme.palette.info.main, theme.palette.grey[600]],
  dataLabels: { enabled: false },
  grid: { show: true, borderColor: theme.palette.divider },
  states: {
    active: { filter: { type: "none" } },
    hover: { filter: { type: "none" } }
    // normal: { filter: { type: "none" } }
  },
  theme: { mode: theme.palette.mode },
  xaxis: {
    crosshairs: { show: false },
    axisBorder: { show: false },
    axisTicks: { show: false },
    categories: categories,
    labels: {
      style: {
        fontSize: "14px",
        colors: theme.palette.text.secondary
      }
    }
  },
  yaxis: {
    min: 0,
    show: true,
    max: 100000,
    tickAmount: 6,
    opposite: theme.direction === "rtl",
    labels: {
      style: {
        fontSize: "14px",
        colors: theme.palette.text.secondary
      },
      formatter: (value) => `${(value / 1000).toFixed(0)}K`
    }
  },
  tooltip: { x: { show: false } },
  stroke: { width: 7, colors: ["transparent"] },
  plotOptions: {
    bar: {
      borderRadius: 5,
      columnWidth: "45%",
      borderRadiusApplication: "end",
      hideZeroBarsWhenGrouped: true
    }
  },
  legend: {
    position: "top",
    fontSize: "14px",
    markers: { shape: "circle" },
    onItemClick: { toggleDataSeries: false },
    itemMargin: { horizontal: 10 }
  },

  responsive: [
    {
      breakpoint: 900,
      options: {
        plotOptions: {
          bar: { columnWidth: "55%", borderRadius: 5 }
        }
      }
    },
    {
      breakpoint: 700,
      options: {
        chart: { height: 550 },
        stroke: { width: 5, colors: ["transparent"] },
        plotOptions: {
          bar: { horizontal: true, columnWidth: "35%", borderRadius: 5 }
        },
        xaxis: {
          min: 0,
          max: 100000,
          tickAmount: 6,
          labels: {
            show: true,
            style: {
              fontSize: "14px",
              colors: theme.palette.text.secondary
            },
            formatter: (value: number) => `${(value / 1000).toFixed(0)}K`
          }
        },
        yaxis: {
          show: true,
          labels: {
            show: true,
            style: {
              fontSize: "14px",
              colors: theme.palette.text.secondary
            }
          }
        }
      }
    }
  ]
});
