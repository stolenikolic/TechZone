import Link from "next/link";
import Image from "next/image";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
// STYLED COMPONENTS
import { BannerRoot, LinkText } from "./styles";

export default function Banners() {
  return (
    <Stack spacing={3} height="100%" direction={{ lg: "column", sm: "row", xs: "column" }}>
      <BannerRoot>
        <BannerContent title="Winter Sale 20% OFF" tag="New Arrivals" url="/" />
        <Image src="/assets/images/market-2/shoe-1.png" alt="shoe" width={177} height={188} />
      </BannerRoot>

      <BannerRoot sx={{ padding: "1rem 1rem 1rem 1.5rem" }}>
        <BannerContent title="Airpods Pro 30% OFF" tag="Accessories" url="/" />
        <Image src="/assets/images/market-2/airpods-1.png" alt="airpods" width={177} height={188} />
      </BannerRoot>
    </Stack>
  );
}

function BannerContent({ title, tag, url }: { title: string; tag: string; url: string }) {
  return (
    <div className="content">
      <Typography variant="body1" fontWeight={500} lineHeight={1} sx={{ mb: 1 }}>
        {tag}
      </Typography>

      <Typography
        variant="body1"
        lineHeight={1.3}
        fontWeight={700}
        fontSize={{ sm: 24, xs: 22 }}
        sx={{ maxWidth: { md: "10rem", sm: "9rem", xs: "8rem" } }}
      >
        {title}
      </Typography>

      <Link href={url}>
        <LinkText fontWeight={500} fontSize={12}>
          EXPLORE NOW
        </LinkText>
      </Link>
    </div>
  );
}
