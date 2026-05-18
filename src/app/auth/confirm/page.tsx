import { shopPageMetadata } from "lib/site-metadata";
import AuthLayout from "pages-sections/sessions/layout";
import AuthConfirmPageView from "pages-sections/sessions/page-view/auth-confirm";

export const metadata = shopPageMetadata("Potvrdite email");

export default function AuthConfirmPage() {
  return (
    <AuthLayout bottomContent={null}>
      <AuthConfirmPageView />
    </AuthLayout>
  );
}
