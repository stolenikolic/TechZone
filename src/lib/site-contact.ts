export const siteContact = {
  phoneDisplay: "065 727 149",
  phoneE164: "+38765727149",
  email: "techzone.prodaja@gmail.com"
} as const;

export function viberChatHref(text = "Pozdrav, javljam se sa Tech Zone sajta."): string {
  const digits = siteContact.phoneE164.replace(/\D/g, "");
  const params = new URLSearchParams({ number: digits, text });
  return `https://viber.com/chat?${params.toString()}`;
}
