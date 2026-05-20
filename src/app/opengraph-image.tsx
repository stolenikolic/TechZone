import { ImageResponse } from "next/og";
import { SITE_NAME } from "lib/site-metadata";

export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default OG slika (PNG) za početnu, pretragu i stranice bez vlastite slike. */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #126389 0%, #08adea 100%)",
          padding: "80px"
        }}>
        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-2px"
          }}>
          TECH ZONE
        </div>
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.9)",
            marginTop: 24,
            textAlign: "center",
            maxWidth: 900
          }}>
          Online prodavnica računarske opreme u BiH
        </div>
      </div>
    ),
    { ...size }
  );
}
