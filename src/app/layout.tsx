import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";
import { geist } from "lib/fonts";
import { rootMetadata } from "lib/site-metadata";

export const metadata: Metadata = rootMetadata;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1F2937"
};

import "overlayscrollbars/overlayscrollbars.css";

// THEME PROVIDER
import ThemeProvider from "theme/theme-provider";

// PRODUCT CART PROVIDER
import CartProvider from "contexts/CartContext";
import { WishlistProvider } from "contexts/WishlistContext";
import { AuthProvider } from "contexts/AuthContext";

// SITE SETTINGS PROVIDER
import SettingsProvider from "contexts/SettingContext";

// GLOBAL CUSTOM COMPONENTS
import RTL from "components/rtl";
import ProgressBar from "components/progress";
import LastNonCartRouteTracker from "components/last-non-cart-route-tracker";
import ScrollToTopOnNavigate from "components/scroll-to-top-on-navigate";
import SafariThemeColor from "components/safari-theme-color";

// IMPORT i18n SUPPORT FILE
import "i18n";

// ==============================================================
interface RootLayoutProps {
  children: ReactNode;
  modal: ReactNode;
}
// ==============================================================

export default function RootLayout({ children, modal }: RootLayoutProps) {
  return (
    <html lang="bs" suppressHydrationWarning>
      <body id="body" className={geist.className}>
        <AuthProvider>
          <WishlistProvider>
            <CartProvider>
            <SettingsProvider>
              <ThemeProvider>
              <SafariThemeColor />
              <RTL>
                <Suspense fallback={null}>
                  <LastNonCartRouteTracker />
                </Suspense>
                <Suspense fallback={null}>
                  <ScrollToTopOnNavigate />
                </Suspense>
                {modal}
                {children}
              </RTL>

              <ProgressBar />
              </ThemeProvider>
            </SettingsProvider>
            </CartProvider>
          </WishlistProvider>
        </AuthProvider>

        <GoogleAnalytics gaId="G-XKPD36JXY0" />
      </body>
    </html>
  );
}
