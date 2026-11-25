import { PropsWithChildren } from "react";
import { ScrollChromeProvider } from "contexts/ScrollChromeContext";
// GLOBAL CUSTOM COMPONENTS
import Sticky from "components/sticky";
import { SearchInput2 } from "components/search-box";
import { CategoryList } from "components/categories";
import { MobileMenu } from "components/mobile-navbar";
import { Topbar, TopbarContact } from "components/topbar";
import { Header, HeaderCart, HeaderLogin, HeaderWishlist, MobileHeader, MobileHeaderActions } from "components/header";
// CUSTOM DATA MODEL
import LayoutModel from "models/Layout.model";

// ==============================================================
interface LayoutProps extends PropsWithChildren {
  data: LayoutModel;
}
// ==============================================================

export default function ShopLayout2({ children, data }: LayoutProps) {
  const { header, mobileNavigation } = data;

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
