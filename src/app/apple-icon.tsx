import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const iconSvg = await readFile(path.join(process.cwd(), "src/app/icon.svg"), "utf8");
  const iconSrc = `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff"
        }}>
        <img src={iconSrc} width={140} height={118} alt="" />
      </div>
    ),
    { ...size }
  );
}
