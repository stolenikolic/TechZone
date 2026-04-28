import Product from "./Product.model";
import User from "./User.model";

export default interface Shop {
  id: string;
  slug: string;
  user: User;
  email: string;
  name: string;
  phone: string;
  address: string;
  verified: boolean;
  products?: Product[];
  coverPicture: string;
  profilePicture: string;
  socialLinks: {
    facebook?: string | null;
    youtube?: string | null;
    twitter?: string | null;
    instagram?: string | null;
  };
}
