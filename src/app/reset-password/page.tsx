import { shopPageMetadata } from "lib/site-metadata";
import { ResetPasswordPageView } from "pages-sections/sessions/page-view";

export const metadata = shopPageMetadata("Reset lozinke");

export default function ResetPassword() {
  return <ResetPasswordPageView />;
}
