import { assertAdminApi } from "./admin-api";

/**
 * Call at the start of admin API handlers (belt-and-suspenders with middleware).
 */
export async function guardAdminApi() {
  return assertAdminApi();
}
