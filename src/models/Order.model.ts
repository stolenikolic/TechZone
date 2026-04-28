import User from "./User.model";

interface Item {
  product_img: string;
  product_name: string;
  product_price: number;
  product_quantity: number;
  variant?: string;
}

export type OrderStatus = "Pending" | "Processing" | "Delivered" | "Cancelled";

interface Order {
  user: User;
  id: string;
  tax: number;
  items: Item[];
  createdAt: Date;
  discount: number;
  deliveredAt: Date;
  totalPrice: number;
  isDelivered: boolean;
  shippingAddress: string;
  status: OrderStatus;
}

export default Order;
