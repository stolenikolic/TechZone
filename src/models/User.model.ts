export default interface User {
  id: string;
  email: string;
  phone: string;
  avatar: string;
  /** @deprecated Auth passwords live in Supabase Auth, not this model */
  password?: string;
  dateOfBirth?: Date | string;
  verified: boolean;
  name: { firstName: string; lastName: string };
}

export interface Profile extends User {
  type: string;
  balance: number;
}
