"use client";

import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import { siteContact, viberChatHref } from "lib/site-contact";
import { ViberIcon } from "./viber-icon";

const itemSx = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  color: "#fff",
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.04em",
  lineHeight: 1,
  whiteSpace: "nowrap"
} as const;

const iconSx = {
  fontSize: 14,
  color: "rgba(255,255,255,0.65)",
  transition: "color 150ms ease"
} as const;

const linkSx = {
  ...itemSx,
  textDecoration: "none",
  transition: "color 150ms ease",
  "&:hover": {
    color: "primary.main",
    "& .MuiSvgIcon-root": { color: "primary.main" }
  }
} as const;

function TopbarDivider() {
  return (
    <Box
      aria-hidden
      sx={{ width: "1px", height: 10, flexShrink: 0, bgcolor: "rgba(255,255,255,0.18)" }}
    />
  );
}

function Fact({ icon, children }: { icon: ReactNode; children: string }) {
  return (
    <Box sx={itemSx}>
      {icon}
      {children}
    </Box>
  );
}

export function TopbarContact() {
  return (
    <Box
      sx={{
        flex: 1,
        width: "100%",
        minWidth: 0,
        display: "grid",
        alignItems: "center",
        gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) auto minmax(0, 1fr)" },
        justifyItems: { xs: "center", sm: "stretch" }
      }}
    >
      <Box sx={{ justifySelf: { xs: "center", sm: "start" }, minWidth: 0 }}>
        <Box
          component="a"
          href={`tel:${siteContact.phoneE164}`}
          sx={{ ...linkSx, fontWeight: 600, letterSpacing: "0.02em" }}
        >
          <PhoneOutlined aria-hidden sx={iconSx} />
          {siteContact.phoneDisplay}
        </Box>
      </Box>

      <Box
        className="topbar-facts"
        sx={{
          display: { xs: "none", sm: "flex" },
          alignItems: "center",
          justifyContent: "center",
          gap: "12px"
        }}
      >
        <Fact icon={<LocalShippingOutlined aria-hidden sx={iconSx} />}>Dostava širom BiH</Fact>
        <TopbarDivider />
        <Fact icon={<PaymentsOutlined aria-hidden sx={iconSx} />}>Plaćanje pouzećem</Fact>
      </Box>

      <Box
        className="topbar-links"
        sx={{
          display: { xs: "none", md: "flex" },
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "12px",
          minWidth: 0
        }}
      >
        <Box
          component="a"
          href={viberChatHref()}
          target="_blank"
          rel="noopener noreferrer"
          sx={linkSx}
        >
          <ViberIcon aria-hidden sx={iconSx} />
          Viber
        </Box>
        <TopbarDivider />
        <Box component="a" href={`mailto:${siteContact.email}`} sx={linkSx}>
          <EmailOutlined aria-hidden sx={iconSx} />
          {siteContact.email}
        </Box>
      </Box>
    </Box>
  );
}
