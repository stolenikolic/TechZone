"use client";

import Link from "next/link";
import Image from "next/image";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import SiteBreadcrumbs from "components/site-breadcrumbs/site-breadcrumbs";
// STYLED COMPONENT
import { Wrapper, StyledButton } from "./styles";

type Props = {
  orderId?: string;
};

export default function OrderConfirmationPageView({ orderId }: Props) {
  return (
    <Container className="mt-2 mb-5">
      <SiteBreadcrumbs
        items={[
          { label: "Korpa", href: "/cart" },
          { label: "Naplata", href: "/checkout" },
          { label: "Plaćanje", href: "/payment" },
          { label: "Potvrda narudžbe" }
        ]}
      />
      <Wrapper>
        <Image
          width={116}
          height={116}
          alt="complete"
          src="/assets/images/illustrations/party-popper.svg"
        />

        <Typography variant="h1" fontWeight={700}>
          Thank you for your purchase!
        </Typography>

        <Typography
          fontSize={16}
          variant="body1"
          color="text.secondary"
          sx={{ padding: ".5rem 2rem" }}
        >
          We have received your order and you will be receiving confirmation email with order
          details.
        </Typography>

        <Typography fontSize={16} variant="body1" color="text.secondary">
          Your order number is <strong>{orderId ? `#${orderId.split("-")[0]}` : "pending"}</strong>.
        </Typography>

        <StyledButton
          color="primary"
          disableElevation
          variant="contained"
          className="button-link"
          LinkComponent={Link}
          href="/"
        >
          Browse products
        </StyledButton>
      </Wrapper>
    </Container>
  );
}
