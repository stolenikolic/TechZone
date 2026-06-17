import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";
import { geist } from "lib/fonts";
import { rootMetadata } from "lib/site-metadata";

export const metadata: Metadata = rootMetadata;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff00"
};

import "overlayscrollbars/overlayscrollbars.css";

import Providers from "./providers";

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
        <Providers modal={modal}>{children}</Providers>

        <GoogleAnalytics gaId="G-XKPD36JXY0" />
      </body>
    </html>
  );
}
