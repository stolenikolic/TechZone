import User from "./User.model";

interface Item {
  product_img: string;
  product_name: string;
  product_price: number;
  product_quantity: number;
  variant?: string;
  product_id?: string;
  supplier_name?: string;
}

export type OrderStatus = "Pending" | "Processing" | "Delivered" | "Cancelled";

interface Order {
  user: User;
  id: string;
  tax: number;
  items: Item[];
  createdAt: Date | string;
  discount: number;
  deliveredAt: Date | string;
  /** Iznos proizvoda prije dostave (postavljeno iz baze kod admin narudžbi). */
  subtotal?: number;
  /** Dostava (KM); ako nije u objektu, UI može podrazumijevati STANDARD_SHIPPING_FEE_KM. */
  shippingTotal?: number;
  totalPrice: number;
  isDelivered: boolean;
  shippingAddress: string;
  deliveryNotes?: string;
  paymentMethod?: string;
  status: OrderStatus;
}

export default Order;
