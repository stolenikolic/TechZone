export const AUTH_CALLBACK_PATH = "/auth/callback";
export const AUTH_CONFIRM_PATH = "/auth/confirm";
export const AUTH_UPDATE_PASSWORD_PATH = "/auth/update-password";
export const AUTH_ERROR_PATH = "/auth/error";

export const CUSTOMER_PROTECTED_PREFIXES = [
  "/profile",
  "/orders",
  "/address",
  "/payment-methods",
  "/support-tickets"
] as const;

export const ADMIN_PROTECTED_PREFIXES = ["/admin", "/vendor"] as const;

export const AUTH_PAGES = ["/login", "/register", "/reset-password"] as const;

export function getAuthCallbackUrl() {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  return `${base}${AUTH_CALLBACK_PATH}`;
}

export function getPasswordResetRedirectUrl() {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  return `${base}${AUTH_UPDATE_PASSWORD_PATH}`;
}
