import { revalidatePath } from "next/cache";

export function revalidateHomepageSurfaces(): void {
  revalidatePath("/");
  revalidatePath("/api/homepage");
  revalidatePath("/api/market-2/main-carousel");
}
