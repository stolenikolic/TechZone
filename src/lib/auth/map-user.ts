import type User from "models/User.model";
import type { UserProfile } from "./types";

export function profileToUserModel(profile: UserProfile): User {
  const fullName = profile.full_name?.trim() ?? "";
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ") || firstName;

  return {
    id: profile.id,
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    avatar: profile.avatar_url ?? "/assets/images/avatars/001-man.svg",
    dateOfBirth: "",
    verified: true,
    name: { firstName, lastName }
  };
}
