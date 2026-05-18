import Image from "next/image";

/** Supabase public bucket or local static assets — safe for next/image. */
export function isNextImageHomepageSrc(src: string): boolean {
  const trimmed = src.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/")) return true;
  try {
    const host = new URL(trimmed).hostname;
    return host.endsWith("supabase.co");
  } catch {
    return false;
  }
}

type Props = {
  src: string;
  alt: string;
  width: number;
  height: number;
  style?: React.CSSProperties;
};

/**
 * Homepage marketing images may be hosted on Supabase (after WebP processing)
 * or on any HTTPS origin (e.g. manufacturer CDN) before conversion completes.
 */
export default function HomepageImage({ src, alt, width, height, style }: Props) {
  if (isNextImageHomepageSrc(src)) {
    return <Image src={src} alt={alt} width={width} height={height} style={style} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      style={{ maxWidth: "100%", height: "auto", ...style }}
    />
  );
}
