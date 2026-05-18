import { shopPageMetadata } from "lib/site-metadata";
import AuthLayout from "pages-sections/sessions/layout";
import AuthErrorPageView from "pages-sections/sessions/page-view/auth-error";

export const metadata = shopPageMetadata("Greška prijave");

type Props = { searchParams: Promise<{ error?: string }> };

export default async function AuthErrorPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const message = error ? decodeURIComponent(error) : "Došlo je do greške pri prijavi.";

  return (
    <AuthLayout bottomContent={null}>
      <AuthErrorPageView message={message} />
    </AuthLayout>
  );
}
