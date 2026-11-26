import { PropsWithChildren } from "react";
import { ScrollChromeProvider } from "contexts/ScrollChromeContext";
import Link from "next/link";
import Image from "next/image";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import { Footer1, FooterApps, FooterContact, FooterLinksWidget, FooterSocialLinks } from "components/footer";
import Sticky from "components/sticky";
import { NavigationList } from "components/navbar";
import { CategoryList } from "components/categories";
import { MobileMenu } from "components/mobile-navbar";
import { SecondaryHeader } from "components/secondary-header";
import { SearchInput1 } from "components/search-box";
import { Topbar, TopbarContact } from "components/topbar";
import { Header, HeaderCart, HeaderLogin, HeaderWishlist, MobileHeader, MobileHeaderActions } from "components/header";
// CUSTOM DATA MODEL
import LayoutModel from "models/Layout.model";
import { siteContact, viberChatHref } from "lib/site-contact";

// ==============================================================
interface Props extends PropsWithChildren {
  data: LayoutModel;
}
// ==============================================================

export default function ShopLayout1({ children, data }: Props) {
  const { footer, header, mobileNavigation } = data;

  const MOBILE_VERSION_HEADER = (
    <MobileHeader>
      <MobileHeader.Left>
        <MobileMenu navigation={header.navigation} categories={header.categoryMenus} />
      </MobileHeader.Left>

      <MobileHeader.Logo logoUrl={mobileNavigation.logo} />

      <MobileHeader.Right>
        <MobileHeaderActions />
      </MobileHeader.Right>
    </MobileHeader>
  );

  return (
    <ScrollChromeProvider>
      <Topbar>
        <TopbarContact />
      </Topbar>

      <Sticky fixedOn={0} scrollDistance={300}>
        <Header mobileHeader={MOBILE_VERSION_HEADER}>
          <Header.Left>
            <Header.Logo url={header.logo} />
          </Header.Left>

          <Header.Mid>
            <NavigationList navigation={header.navigation} />
          </Header.Mid>

          <Header.Right>
            <HeaderLogin />
            <HeaderWishlist />
            <HeaderCart />
          </Header.Right>
        </Header>
      </Sticky>

      <SecondaryHeader elevation={0}>
        <SecondaryHeader.Left>
          <CategoryList categories={header.categoryMenus} />
        </SecondaryHeader.Left>

        <SecondaryHeader.Right>
          <SearchInput1 categories={header.categories} />
        </SecondaryHeader.Right>
      </SecondaryHeader>

      <Box component="main">{children}</Box>

      <Footer1 bgcolor="footer.main">
        <Footer1.Brand>
          <Link href="/">
            <Image
              src={footer.logo}
              alt="logo"
              width={125}
              height={40}
              style={{ objectFit: "contain", height: 40, width: "auto" }}
            />
          </Link>

          <Typography
            variant="body1"
            sx={{ mt: 1, mb: 3, maxWidth: 370, color: "white", lineHeight: 1.7 }}
          >
            {footer.description}
          </Typography>

          <FooterApps playStoreUrl={footer.playStoreUrl} appleStoreUrl={footer.appStoreUrl} />
        </Footer1.Brand>

        <Footer1.Widget1>
          <FooterLinksWidget title="O nama" links={footer.about} />
        </Footer1.Widget1>

        <Footer1.Widget2>
          <FooterLinksWidget title="Podrška kupcima" links={footer.customers} />
        </Footer1.Widget2>

        <Footer1.Contact>
          <FooterContact
            phone={footer.contact.phone}
            email={footer.contact.email}
            address={footer.contact.address}
            phoneHref={`tel:${siteContact.phoneE164}`}
            viberHref={viberChatHref()}
            pageHref="/kontakt"
          />

          <FooterSocialLinks links={footer.socials} />
        </Footer1.Contact>

        <Footer1.Copyright>
          <Divider sx={{ borderColor: "grey.800" }} />

          <Typography
            variant="body2"
            sx={{ py: 3, textAlign: "center", span: { fontWeight: 500 } }}
          >
            &copy; {new Date().getFullYear()} <span>Tech Zone</span>. Sva prava zadržana.
          </Typography>
        </Footer1.Copyright>
      </Footer1>
    </ScrollChromeProvider>
  );
}
