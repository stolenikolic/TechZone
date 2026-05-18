import { shopPageMetadata } from "lib/site-metadata";
import UpdatePasswordPageView from "pages-sections/sessions/page-view/update-password";
import AuthLayout from "pages-sections/sessions/layout";

export const metadata = shopPageMetadata("Nova lozinka");

export default function UpdatePasswordPage() {
  return (
    <AuthLayout bottomContent={null}>
      <UpdatePasswordPageView />
    </AuthLayout>
  );
}
