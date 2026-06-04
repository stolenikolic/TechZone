import Image from "next/image";
import { format } from "date-fns/format";
// MUI
import Card from "@mui/material/Card";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import { FlexBetween, FlexBox } from "components/flex-box";
// CUSTOM UTILS LIBRARY FUNCTION
import { formatPrice } from "lib";
// CUSTOM DATA MODEL
import Order from "models/Order.model";

// ==============================================================
type Props = { order: Order };
// ==============================================================

export default function OrderedProducts({ order }: Props) {
  const { id, createdAt, items, deliveredAt } = order;

  return (
    <Card
      elevation={0}
      sx={{
        p: 0,
        mb: 4,
        border: "1px solid",
        borderColor: "grey.100"
      }}
    >
      <FlexBetween px={3} py={2} flexWrap="wrap" gap={1} bgcolor="grey.50">
        <Item title="Order ID:" value={id} />
        <Item title="Placed on:" value={format(new Date(createdAt), "dd MMM, yyyy")} />
        <Item
          title="Delivered on:"
          value={deliveredAt ? format(new Date(deliveredAt), "dd MMM, yyyy") : "None"}
        />
      </FlexBetween>

      {items.map((item, ind) => (
        <FlexBetween px={2} py={1} flexWrap="wrap" key={ind} gap={1}>
          <FlexBox gap={2} alignItems="center">
            <Avatar variant="rounded" sx={{ height: 60, width: 60, backgroundColor: "grey.50" }}>
              <Image fill alt={item.product_name} src={item.product_img} sizes="(60px, 60px)" />
            </Avatar>

            <div>
              <Typography noWrap variant="h6">
                {item.product_name}
              </Typography>

              <Typography lineHeight={2} variant="body1" color="text.secondary">
                {formatPrice(item.product_price)} x {item.product_quantity}
              </Typography>
            </div>
          </FlexBox>

          {(item.offer_label ?? item.variant) && (
            <Typography noWrap variant="body1" color="text.secondary">
              Opcija kupovine: {item.offer_label ?? item.variant}
            </Typography>
          )}

          <Button variant="text" color="primary">
            Write a Review
          </Button>
        </FlexBetween>
      ))}
    </Card>
  );
}

function Item({ title, value }: { title: string; value: string }) {
  return (
    <FlexBox gap={1} alignItems="center">
      <Typography variant="body1" color="text.secondary">
        {title}
      </Typography>

      <Typography variant="body1">{value}</Typography>
    </FlexBox>
  );
}
