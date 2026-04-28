import User from "./User.model";

export interface Message {
  name: string;
  date: string;
  text: string;
  imgUrl: string;
}

export default interface Ticket {
  user: User;
  id: string;
  slug: string;
  type: string;
  date: string;
  title: string;
  status: string;
  category: string;
  conversation: null | Message[];
}
