import path from "path";
import type { NextConfig } from "next";
import { fileURLToPath } from "url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

const r2Hostname = process.env.R2_PUBLIC_URL?.replace(/^https?:\/\//, "").split("/")[0];

const nextConfig: NextConfig = {
  // Avoid picking parent package-lock.json (TechZone-main/) as workspace root on CI/Netlify.
  turbopack: {
    root: appRoot
  },
  images: {
    // Avoid serving stale optimized images for hours after Storage URL changes.
    minimumCacheTTL: 60,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ui-lib.com"
      },
      {
        protocol: "https",
        hostname: "media.icdn.hu"
      },
      {
        protocol: "https",
        hostname: "bxicebgwhwgtofdxnkks.supabase.co",
        pathname: "/storage/v1/object/public/**"
      },
      ...(r2Hostname
        ? [
            {
              protocol: "https" as const,
              hostname: r2Hostname,
              pathname: "/**"
            }
          ]
        : []),
      {
        protocol: "https",
        hostname: "*.r2.dev",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "www.gigabyte.com",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "gigabyte.com",
        pathname: "/**"
      }
    ]
  },
  async redirects() {
    return [
      { source: "/products/search", destination: "/pretraga", permanent: true },
      { source: "/products/search/:path*", destination: "/pretraga/:path*", permanent: true },
      { source: "/products", destination: "/pretraga", permanent: true },
      { source: "/proizvodi", destination: "/pretraga", permanent: true },
      { source: "/products/:path*", destination: "/proizvodi/:path*", permanent: true },
      { source: "/categories", destination: "/kategorije", permanent: true },
      { source: "/categories/:path*", destination: "/kategorije/:path*", permanent: true },
      { source: "/cart", destination: "/korpa", permanent: true },
      { source: "/checkout", destination: "/narudzba", permanent: true },
      { source: "/payment", destination: "/placanje", permanent: true },
      { source: "/order-confirmation", destination: "/potvrda", permanent: true },
      { source: "/login", destination: "/prijava", permanent: true },
      { source: "/register", destination: "/registracija", permanent: true },
      { source: "/reset-password", destination: "/reset-lozinke", permanent: true },
      { source: "/wish-list", destination: "/lista-zelja", permanent: true },
      { source: "/orders", destination: "/narudzbe", permanent: true },
      { source: "/orders/:path*", destination: "/narudzbe/:path*", permanent: true },
      { source: "/profile", destination: "/profil", permanent: true },
      { source: "/profile/:path*", destination: "/profil/:path*", permanent: true }
    ];
  }
};

export default nextConfig;
