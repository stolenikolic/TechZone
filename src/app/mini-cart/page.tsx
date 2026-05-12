import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_KEY = "tz_last_non_cart";
const FALLBACK_PATH = "/products";

function decodePath(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/")) return null;
    if (decoded.startsWith("/mini-cart")) return null;
    return decoded;
  } catch {
    return null;
  }
}

export default async function MiniCart() {
  const store = await cookies();
  const lastPath = decodePath(store.get(COOKIE_KEY)?.value);
  return redirect(lastPath ?? FALLBACK_PATH);
}
