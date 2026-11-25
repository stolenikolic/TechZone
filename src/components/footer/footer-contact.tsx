import type { ReactNode } from "react";
import { Fragment } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import { ViberIcon } from "components/topbar/viber-icon";
import { Heading, StyledLink } from "./styles";

// ==============================================================
interface Props {
  email: string;
  phone: string;
  address: string;
  phoneHref?: string;
  viberHref?: string;
  pageHref?: string;
  pageLabel?: string;
}
// ==============================================================

const rowSx = {
  display: "flex",
  alignItems: "flex-start",
  gap: 1,
  py: 0.6,
  color: "inherit",
  textDecoration: "none",
  overflowWrap: "anywhere",
  "& .footer-contact-icon": {
    fontSize: 18,
    mt: "1px",
    flexShrink: 0,
    opacity: 0.72
  },
  "&:hover": {
    textDecoration: "underline",
    "& .footer-contact-icon": { opacity: 1, color: "primary.main" }
  }
} as const;

function ContactRow({
  href,
  external,
  icon,
  children
}: {
  href: string;
  external?: boolean;
  icon: ReactNode;
  children: string;
}) {
  return (
    <Box
      component="a"
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      sx={rowSx}
    >
      {icon}
      <Typography component="span" variant="body1" sx={{ overflowWrap: "anywhere", lineHeight: 1.4 }}>
        {children}
      </Typography>
    </Box>
  );
}

export function FooterContact({
  email,
  phone,
  address,
  phoneHref,
  viberHref,
  pageHref,
  pageLabel = "Saznaj više"
}: Props) {
  return (
    <Fragment>
      <Heading>Kontakt</Heading>

      {address ? (
        <Typography variant="body1" sx={{ py: 0.6 }}>
          {address}
        </Typography>
      ) : null}

      <ContactRow href={phoneHref || `tel:${phone}`} icon={<PhoneOutlined className="footer-contact-icon" />}>
        {phone}
      </ContactRow>

      {viberHref ? (
        <ContactRow href={viberHref} external icon={<ViberIcon className="footer-contact-icon" />}>
          Viber
        </ContactRow>
      ) : null}

      <ContactRow href={`mailto:${email}`} icon={<EmailOutlined className="footer-contact-icon" />}>
        {email}
      </ContactRow>

      {pageHref ? (
        <Box sx={{ mt: 0.5, mb: 2 }}>
          <StyledLink href={pageHref}>{pageLabel}</StyledLink>
        </Box>
      ) : (
        <Box sx={{ mb: 2 }} />
      )}
    </Fragment>
  );
}
