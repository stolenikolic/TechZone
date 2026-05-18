import { shopPageMetadata } from "lib/site-metadata";
import { RegisterPageView } from "pages-sections/sessions/page-view";

export const metadata = shopPageMetadata("Registracija");

export default function Register() {
  return <RegisterPageView />;
}
