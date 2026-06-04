"use client";

import Button from "@mui/material/Button";
import type { ButtonProps } from "@mui/material/Button";

type Props = {
  productTitle: string;
  productSlug: string;
  fullWidth?: boolean;
} & Pick<ButtonProps, "size" | "sx">;

function buildViberChatUrl(phoneE164: string, text: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  const params = new URLSearchParams({ number: digits, text });
  return `https://viber.com/chat?${params.toString()}`;
}

export default function ViberChatButton({ productTitle, productSlug, fullWidth, size = "large", sx }: Props) {
  const phone = process.env.NEXT_PUBLIC_VIBER_PHONE?.trim() ?? "";
  if (!phone) return null;

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const productUrl = siteUrl ? `${siteUrl}/products/${productSlug}` : `/products/${productSlug}`;
  const message = `Pozdrav, zanima me artikal: ${productTitle}\n${productUrl}`;
  const href = buildViberChatUrl(phone, message);

  return (
    <Button
      component="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      variant="outlined"
      color="primary"
      size={size}
      fullWidth={fullWidth}
      sx={sx}
    >
      Pitaj na Viberu
    </Button>
  );
}
