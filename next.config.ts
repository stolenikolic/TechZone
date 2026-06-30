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
        hostname: "www.gigabyte.com",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "gigabyte.com",
        pathname: "/**"
      }
    ]
  }
};

export default nextConfig;
