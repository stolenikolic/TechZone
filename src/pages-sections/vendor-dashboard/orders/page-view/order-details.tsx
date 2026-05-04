"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
// LOCAL CUSTOM COMPONENT
import OrderActions from "../order-actions";
import TotalSummery from "../total-summery";
import PageWrapper from "../../page-wrapper";
import OrderedProduct from "../ordered-product";
import ShippingAddress from "../shipping-address";
import { STANDARD_SHIPPING_FEE_KM } from "lib/orders/constants";
// CUSTOM DATA MODEL
import Order, { OrderStatus } from "models/Order.model";

// ==============================================================
type Props = { order: Order };
// ==============================================================

export default function OrderDetailsPageView({ order }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const shippingFee = order.shippingTotal ?? STANDARD_SHIPPING_FEE_KM;
  const subtotalForSummary =
    order.subtotal ??
    Math.max(0, Math.round((Number(order.totalPrice) - shippingFee) * 100) / 100);

  const handleSave = async () => {
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update order status.");
      }

      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update order status.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageWrapper title="Order Details">
      <Grid container spacing={3}>
        <Grid size={12}>
          <Card sx={{ p: 3 }}>
            {/* ADD PRODUCT & CHANGE ORDER STATUS ACTION  */}
            <OrderActions
              id={order.id}
              status={status}
              createdAt={order.createdAt}
              onStatusChange={setStatus}
            />

            {/* ORDERED PRODUCT LIST */}
            {order.items.map((item, index) => (
              <OrderedProduct product={item} key={index} />
            ))}
          </Card>
        </Grid>

        {/* SHIPPING ADDRESS & CUSTOMER NOTES */}
        <Grid size={{ md: 6, xs: 12 }}>
          <ShippingAddress
            customerName={[order.user.name.firstName, order.user.name.lastName].filter(Boolean).join(" ").trim()}
            customerEmail={order.user.email}
            customerPhone={order.user.phone}
            address={order.shippingAddress}
            deliveryNotes={order.deliveryNotes}
          />
        </Grid>

        {/* TOTAL SUMMERY OF ORDER */}
        <Grid size={{ md: 6, xs: 12 }}>
          <TotalSummery
            key={order.id}
            subtotal={subtotalForSummary}
            shippingTotal={shippingFee}
            tax={order.tax}
            discount={order.discount}
            paymentMethod={order.paymentMethod}
          />
        </Grid>

        {error ? (
          <Grid size={12}>
            <Alert severity="error">{error}</Alert>
          </Grid>
        ) : null}

        {/* CHANGE BUTTON */}
        <Grid size={12}>
          <Button
            variant="contained"
            color="info"
            loading={isSaving}
            disabled={status === order.status}
            onClick={handleSave}
          >
            Save Changes
          </Button>
        </Grid>
      </Grid>
    </PageWrapper>
  );
}
