import type { AppRole } from "./types";

export function isAdminRole(role: AppRole | undefined | null) {
  return role === "admin";
}
