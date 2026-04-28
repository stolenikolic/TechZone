import User from "./User.model";

export default interface Address {
  id: string;
  user: User;
  city: string;
  title: string;
  phone: string;
  street: string;
  country: string;
}
