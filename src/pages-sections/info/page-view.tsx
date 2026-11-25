"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import MuiLink from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import Container from "components/Container";
import { SectionHeader } from "components/section-header";
import { SiteBreadcrumbs } from "components/site-breadcrumbs";
import { siteContact, viberChatHref } from "lib/site-contact";

const cardSx = {
  p: { sm: 3, xs: 2 },
  mb: 3,
  border: "1px solid",
  borderColor: "grey.100"
} as const;

export function InfoPage({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <div className="bg-white pt-2 pb-4">
      <Container>
        <SiteBreadcrumbs items={[{ label: title }]} />
        <SectionHeader title={title} />
        <Typography color="grey.600" sx={{ mb: 3, maxWidth: 720 }}>
          {lede}
        </Typography>
        <Box sx={{ maxWidth: 720 }}>{children}</Box>
      </Container>
    </div>
  );
}

export function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card elevation={0} sx={cardSx}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        {title}
      </Typography>
      {children}
    </Card>
  );
}

export function InfoParagraph({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.7, "&:last-child": { mb: 0 } }}>
      {children}
    </Typography>
  );
}

export function InfoLink({ href, children }: { href: string; children: ReactNode }) {
  const external = /^(https?:|mailto:|tel:)/.test(href);

  if (external) {
    return (
      <MuiLink
        href={href}
        underline="hover"
        color="primary"
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      >
        {children}
      </MuiLink>
    );
  }

  return (
    <MuiLink component={Link} href={href} underline="hover" color="primary">
      {children}
    </MuiLink>
  );
}

function ContactChannels() {
  return (
    <>
      Javite se telefonom na <InfoLink href={`tel:${siteContact.phoneE164}`}>{siteContact.phoneDisplay}</InfoLink>,
      putem <InfoLink href={viberChatHref()}>Vibera</InfoLink> ili e-mailom na{" "}
      <InfoLink href={`mailto:${siteContact.email}`}>{siteContact.email}</InfoLink>.
    </>
  );
}

export function AboutPageView() {
  return (
    <InfoPage
      title="O nama"
      lede="Tech Zone je online prodavnica računarske opreme i komponenti za kupce u Bosni i Hercegovini."
    >
      <InfoCard title="Prodavnica">
        <InfoParagraph>
          Na sajtu birate komponente, periferiju i ostalu računarsku opremu. Pregled kreće od{" "}
          <InfoLink href="/kategorije">kategorija</InfoLink>.
        </InfoParagraph>
      </InfoCard>

      <InfoCard title="Narudžba">
        <InfoParagraph>
          Narudžbu završavate na sajtu: proizvod ide u korpu, zatim unosite podatke za dostavu.
          Plaćanje je pouzećem ili žiralno. Koraci su na stranici{" "}
          <InfoLink href="/kako-naruciti">Kako naručiti</InfoLink>.
        </InfoParagraph>
      </InfoCard>

      <InfoCard title="Javljanje">
        <InfoParagraph>
          <ContactChannels /> Sve adrese su i na stranici <InfoLink href="/kontakt">Kontakt</InfoLink>.
        </InfoParagraph>
      </InfoCard>
    </InfoPage>
  );
}

export function TermsPageView() {
  return (
    <InfoPage
      title="Uslovi kupovine"
      lede="Ovo su pravila po kojima Tech Zone prima narudžbu."
    >
      <InfoCard title="Narudžba">
        <InfoParagraph>
          Narudžba nastaje kad na sajtu izaberete proizvod, dodate ga u korpu, unesete podatke za
          dostavu i potvrdite narudžbu.
        </InfoParagraph>
        <InfoParagraph>
          Važi cijena koja je na sajtu u trenutku kad potvrdite narudžbu.
        </InfoParagraph>
      </InfoCard>

      <InfoCard title="Plaćanje">
        <InfoParagraph>
          Plaća se pouzećem, pri preuzimanju pošiljke, ili žiralno, uplatom na račun. Detalj je na
          stranici <InfoLink href="/nacin-placanja">Plaćanje</InfoLink>.
        </InfoParagraph>
      </InfoCard>

      <InfoCard title="Dostava">
        <InfoParagraph>
          Dostava ide na adresu u Bosni i Hercegovini. Rok zavisi od toga da li je roba dostupna.
          Broj dana ovdje nije zagarantovan. Više na stranici <InfoLink href="/dostava">Dostava</InfoLink>.
        </InfoParagraph>
      </InfoCard>

      <InfoCard title="Reklamacija">
        <InfoParagraph>
          Ako proizvod nije ispravan, javite se telefonom, Viberom ili e-mailom. Rok za odustanak od
          ispravne kupovine nije naveden. Postupak je na stranici{" "}
          <InfoLink href="/reklamacije">Reklamacije i povrat</InfoLink>.
        </InfoParagraph>
      </InfoCard>
    </InfoPage>
  );
}

export function PrivacyPageView() {
  return (
    <InfoPage
      title="Politika privatnosti"
      lede="Ovdje piše koje podatke Tech Zone traži i čemu služe."
    >
      <InfoCard title="Narudžba">
        <InfoParagraph>
          Za dostavu tražimo ime i prezime, broj telefona, e-mail, adresu, grad, poštanski broj i
          napomenu ako je upišete. Ti podaci služe da se narudžba isporuči i da vas možemo
          kontaktirati u vezi s njom.
        </InfoParagraph>
      </InfoCard>

      <InfoCard title="Nalog">
        <InfoParagraph>
          Ako se registrujete, tražimo ime, e-mail i lozinku. Lozinka služi za prijavu. Sesija ostaje
          u pregledniku dok se ne odjavite.
        </InfoParagraph>
      </InfoCard>

      <InfoCard title="Ovaj preglednik">
        <InfoParagraph>
          Korpa i lista želja ostaju sačuvane u pregledniku na uređaju s kojeg kupujete.
        </InfoParagraph>
      </InfoCard>

      <InfoCard title="Posjete">
        <InfoParagraph>
          Sajt koristi Google Analytics da vidi koje se stranice otvaraju.
        </InfoParagraph>
      </InfoCard>
    </InfoPage>
  );
}

export function HowToOrderPageView() {
  return (
    <InfoPage title="Kako naručiti" lede="Narudžba ide kroz sajt. Plaća se pouzećem ili žiralno.">
      <InfoCard title="Koraci">
        <Box
          component="ol"
          sx={{
            m: 0,
            pl: 2.5,
            "& li": { mb: 1.25, lineHeight: 1.7, "&:last-child": { mb: 0 } }
          }}
        >
          <Typography component="li" variant="body1">
            Otvorite proizvod i dodajte ga u korpu.
          </Typography>
          <Typography component="li" variant="body1">
            U <InfoLink href="/korpa">korpi</InfoLink> izaberite „Nastavi na narudžbu“.
          </Typography>
          <Typography component="li" variant="body1">
            Unesite ime i prezime, telefon, e-mail, adresu, grad i poštanski broj.
          </Typography>
          <Typography component="li" variant="body1">
            Na sljedećem koraku potvrdite plaćanje pouzećem.
          </Typography>
          <Typography component="li" variant="body1">
            Poslije potvrde otvara se stranica sa brojem narudžbe.
          </Typography>
        </Box>
      </InfoCard>

      <InfoCard title="Žiralno">
        <InfoParagraph>
          Na sajtu se narudžba potvrđuje kao pouzeće. Ako plaćate žiralno, javite se prije potvrde.{" "}
          <ContactChannels /> Poslije toga šaljemo podatke za uplatu.
        </InfoParagraph>
      </InfoCard>
    </InfoPage>
  );
}

export function DeliveryPageView() {
  return (
    <InfoPage title="Dostava" lede="Dostava ide na adresu u Bosni i Hercegovini.">
      <InfoCard title="Adresa">
        <InfoParagraph>
          Pri narudžbi unosite ulicu, grad i poštanski broj. Rok zavisi od toga da li je roba
          dostupna. Broj dana nije unaprijed zagarantovan.
        </InfoParagraph>
        <InfoParagraph>
          Načini plaćanja su na stranici <InfoLink href="/nacin-placanja">Plaćanje</InfoLink>.
        </InfoParagraph>
      </InfoCard>
    </InfoPage>
  );
}

export function PaymentInfoPageView() {
  return (
    <InfoPage title="Plaćanje" lede="Narudžbu plaćate pouzećem ili žiralno.">
      <InfoCard title="Pouzeće">
        <InfoParagraph>
          Plaćate kad preuzmete pošiljku. Iznos je cijena iz narudžbe.
        </InfoParagraph>
        <InfoParagraph>
          Kako da dođete do tog koraka piše na stranici{" "}
          <InfoLink href="/kako-naruciti">Kako naručiti</InfoLink>.
        </InfoParagraph>
      </InfoCard>

      <InfoCard title="Žiralno">
        <InfoParagraph>
          Plaćate uplatom na račun. <ContactChannels /> Poslije toga šaljemo podatke za uplatu.
        </InfoParagraph>
      </InfoCard>
    </InfoPage>
  );
}

export function ReturnsPageView() {
  return (
    <InfoPage
      title="Reklamacije i povrat"
      lede="Ako proizvod koji ste primili nije ispravan, javite nam se."
    >
      <InfoCard title="Neispravan proizvod">
        <InfoParagraph>
          <ContactChannels /> Recite broj narudžbe i šta nije u redu.
        </InfoParagraph>
        <InfoParagraph>
          Rok za odustanak od kupovine ispravnog proizvoda ovdje nije naveden.
        </InfoParagraph>
      </InfoCard>
    </InfoPage>
  );
}

export function ContactPageView() {
  const channels = [
    {
      title: "Telefon",
      href: `tel:${siteContact.phoneE164}`,
      label: siteContact.phoneDisplay
    },
    {
      title: "Viber",
      href: viberChatHref(),
      label: "Otvori razgovor"
    },
    {
      title: "E-mail",
      href: `mailto:${siteContact.email}`,
      label: siteContact.email
    }
  ];

  return (
    <div className="bg-white pt-2 pb-4">
      <Container>
        <SiteBreadcrumbs items={[{ label: "Kontakt" }]} />
        <SectionHeader title="Kontakt" />
        <Typography color="grey.600" sx={{ mb: 3, maxWidth: 720 }}>
          Tech Zone je online prodavnica. Poruku šaljete telefonom, Viberom ili e-mailom.
        </Typography>

        <Grid container spacing={3}>
          {channels.map((channel) => (
            <Grid key={channel.title} size={{ md: 4, xs: 12 }}>
              <Card elevation={0} sx={{ ...cardSx, mb: 0, height: "100%" }}>
                <Typography variant="h5" sx={{ mb: 2 }}>
                  {channel.title}
                </Typography>
                <Typography variant="body1" sx={{ overflowWrap: "anywhere" }}>
                  <InfoLink href={channel.href}>{channel.label}</InfoLink>
                </Typography>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </div>
  );
}
