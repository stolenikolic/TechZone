import { Fragment } from "react";
// LOCAL CUSTOM COMPONENTS
import OrderSummery from "../order-summery";
import OrderProgress from "../order-progress";
import OrderedProducts from "../ordered-products";
import DashboardHeader from "../../dashboard-header";
// CUSTOM DATA MODEL
import Order from "models/Order.model";

// =============================================================
type Props = { order: Order };
// =============================================================

export function OrderDetailsPageView({ order }: Props) {
  return (
    <Fragment>
      <DashboardHeader href="/orders" title="Order Details" />

      <OrderProgress
        status={order.status}
        deliveredAt={order.deliveredAt}
        isDelivered={order.isDelivered}
      />

      <OrderedProducts order={order} />

      <OrderSummery order={order} />
    </Fragment>
  );
}
