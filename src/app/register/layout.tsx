import type { PropsWithChildren } from "react";
import AuthLayout from "pages-sections/sessions/layout";
import RegisterBottom from "pages-sections/sessions/components/register-bottom";

export default function Layout({ children }: PropsWithChildren) {
  return <AuthLayout bottomContent={<RegisterBottom />}>{children}</AuthLayout>;
}
