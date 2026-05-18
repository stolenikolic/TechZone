import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
