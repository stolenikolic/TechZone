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
    <Container className="mt-1 mb-5">
      <SiteBreadcrumbs
        items={[
          { label: "Korpa", href: "/korpa" },
          { label: "Naplata", href: "/narudzba" },
          { label: "Plaćanje", href: "/placanje" },
          { label: "Potvrda narudžbe" }
        ]}
      />
      <Wrapper>
        <Image
          width={116}
          height={116}
          alt="Narudžba je primljena"
          src="/assets/images/illustrations/party-popper.svg"
        />

        <Typography variant="h1" fontWeight={700}>
          Hvala na kupovini!
        </Typography>

        <Typography
          fontSize={16}
          variant="body1"
          color="text.secondary"
          sx={{ padding: ".5rem 2rem" }}
        >
          Primili smo vašu narudžbu. Potvrda sa detaljima stiže na e-mail.
        </Typography>

        <Typography fontSize={16} variant="body1" color="text.secondary">
          Broj narudžbe je <strong>{orderId ? `#${orderId.split("-")[0]}` : "na čekanju"}</strong>.
        </Typography>

        <StyledButton
          color="primary"
          disableElevation
          variant="contained"
          className="button-link"
          LinkComponent={Link}
          href="/"
        >
          Pregledaj proizvode
        </StyledButton>
      </Wrapper>
    </Container>
  );
}
