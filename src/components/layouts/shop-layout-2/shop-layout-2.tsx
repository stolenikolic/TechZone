import { PropsWithChildren } from "react";
import { ScrollChromeProvider } from "contexts/ScrollChromeContext";
// GLOBAL CUSTOM COMPONENTS
import Sticky from "components/sticky";
import { SearchInput2 } from "components/search-box";
import { CategoryList } from "components/categories";
import { MobileMenu } from "components/mobile-navbar";
import { Topbar, TopbarLanguageSelector, TopbarSocialLinks } from "components/topbar";
import { Header, HeaderCart, HeaderLogin, HeaderWishlist, MobileHeader, HeaderSearch } from "components/header";
// CUSTOM DATA MODEL
import LayoutModel from "models/Layout.model";

// ==============================================================
interface LayoutProps extends PropsWithChildren {
  data: LayoutModel;
}
// ==============================================================

export default function ShopLayout2({ children, data }: LayoutProps) {
  const { header, topbar, mobileNavigation } = data;

  const MOBILE_VERSION_HEADER = (
    <MobileHeader>
      <MobileHeader.Left>
        <MobileMenu navigation={header.navigation} categories={header.categoryMenus} />
      </MobileHeader.Left>

      <MobileHeader.Logo logoUrl={mobileNavigation.logo} />

      <MobileHeader.Right>
        <HeaderSearch>
          <SearchInput2 />
        </HeaderSearch>

        <HeaderLogin />
        <HeaderWishlist />
        <HeaderCart />
      </MobileHeader.Right>
    </MobileHeader>
  );

  return (
    <ScrollChromeProvider>
      <Topbar>
        <Topbar.Left label={topbar.label} title={topbar.title} />

        <Topbar.Right>
          <TopbarLanguageSelector languages={topbar.languageOptions} />
          <TopbarSocialLinks links={topbar.socials} />
        </Topbar.Right>
      </Topbar>

      <Sticky fixedOn={0} scrollDistance={70}>
        <Header mobileHeader={MOBILE_VERSION_HEADER}>
          <Header.Left>
            <Header.Logo url={header.logo} />

            <Header.CategoryDropdown>
              <CategoryList categories={header.categoryMenus} />
            </Header.CategoryDropdown>
          </Header.Left>

          <Header.Mid>
            <SearchInput2 />
          </Header.Mid>

          <Header.Right>
            <HeaderLogin />
            <HeaderWishlist />
            <HeaderCart />
          </Header.Right>
        </Header>
      </Sticky>

      {children}
    </ScrollChromeProvider>
  );
}
