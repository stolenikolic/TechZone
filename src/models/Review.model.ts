import User from "./User.model";
import Product from "./Product.model";

export default interface Review {
  id: string;
  rating: number;
  customer: User;
  comment: string;
  product: Product;
  published?: boolean;
}
