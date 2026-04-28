import Card from "@mui/material/Card";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import FlexBetween from "components/flex-box/flex-between";
// LOCAL CUSTOM COMPONENT
import DataListTable from "./table";
// API FUNCTIONS
import api from "utils/__api__/dashboard";
// DATA TYPES
import { RecentPurchased } from "./types";

// table column list
const tableHeading = [
  { id: "orderId", label: "Order ID", alignRight: false },
  { id: "product", label: "Product", alignRight: false },
  { id: "payment", label: "Payment", alignRight: false },
  { id: "amount", label: "Amount", alignCenter: true }
];

export default async function RecentPurchase() {
  const recentPurchase: RecentPurchased[] = await api.recentPurchase();

  return (
    <Card>
      <FlexBetween px={3} py={2.5}>
        <Typography variant="h5">Recent Purchases</Typography>
        <Button size="small" color="info" variant="outlined">
          All Orders
        </Button>
      </FlexBetween>

      <DataListTable dataList={recentPurchase} tableHeading={tableHeading} type="RECENT_PURCHASE" />
    </Card>
  );
}
