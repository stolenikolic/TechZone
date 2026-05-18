import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";
import { geist } from "lib/fonts";
import { rootMetadata } from "lib/site-metadata";

export const metadata: Metadata = rootMetadata;

import "overlayscrollbars/overlayscrollbars.css";

// THEME PROVIDER
import ThemeProvider from "theme/theme-provider";

// PRODUCT CART PROVIDER
import CartProvider from "contexts/CartContext";

// SITE SETTINGS PROVIDER
import SettingsProvider from "contexts/SettingContext";

// GLOBAL CUSTOM COMPONENTS
import RTL from "components/rtl";
import ProgressBar from "components/progress";
import LastNonCartRouteTracker from "components/last-non-cart-route-tracker";

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
        <CartProvider>
          <SettingsProvider>
            <ThemeProvider>
              <RTL>
                <Suspense fallback={null}><LastNonCartRouteTracker /></Suspense>
                {modal}
                {children}
              </RTL>

              <ProgressBar />
            </ThemeProvider>
          </SettingsProvider>
        </CartProvider>

        <GoogleAnalytics gaId="G-XKPD36JXY0" />
      </body>
    </html>
  );
}
