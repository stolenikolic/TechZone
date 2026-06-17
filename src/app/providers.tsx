"use client";

import type { PropsWithChildren, ReactNode } from "react";
import { Suspense } from "react";
import ThemeProvider from "theme/theme-provider";
import CartProvider from "contexts/CartContext";
import { WishlistProvider } from "contexts/WishlistContext";
import { AuthProvider } from "contexts/AuthContext";
import SettingsProvider from "contexts/SettingContext";
import RTL from "components/rtl";
import LastNonCartRouteTracker from "components/last-non-cart-route-tracker";
import ScrollToTopOnNavigate from "components/scroll-to-top-on-navigate";
import SafariThemeColor from "components/safari-theme-color";
import ProgressBar from "components/progress";

type Props = PropsWithChildren<{
  modal: ReactNode;
}>;

export default function Providers({ children, modal }: Props) {
  return (
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
  );
}
