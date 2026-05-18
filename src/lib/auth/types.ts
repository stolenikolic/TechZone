export type AppRole = "customer" | "admin";

export type UserProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: AppRole;
  email?: string;
};
