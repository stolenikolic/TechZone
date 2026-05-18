import { shopPageMetadata } from "lib/site-metadata";
import { LoginPageView } from "pages-sections/sessions/page-view";

export const metadata = shopPageMetadata("Prijava");

export default function Login() {
  return <LoginPageView />;
}
