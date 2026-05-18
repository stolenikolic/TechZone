import Link from "next/link";
import HomepageImage from "components/homepage-image/homepage-image";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { HeroSideBannerItem } from "lib/homepage/types";
// STYLED COMPONENTS
import { BannerImageWrap, BannerRoot, LinkText } from "./styles";

type Props = {
  items: HeroSideBannerItem[];
};

export default function Banners({ items }: Props) {
  return (
    <Stack spacing={3} height="100%" direction={{ lg: "column", sm: "row", xs: "column" }}>
      {items.map((item) => (
        <BannerRoot key={item.id}>
          <BannerContent
            title={item.title}
            tag={item.tag}
            url={item.linkUrl}
            buttonLabel={item.buttonLabel}
          />
          <BannerImageWrap>
            <HomepageImage
              src={item.imgUrl}
              alt={item.title}
              width={177}
              height={188}
              style={{
                width: "auto",
                height: "auto",
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain"
              }}
            />
          </BannerImageWrap>
        </BannerRoot>
      ))}
    </Stack>
  );
}

function BannerContent({
  title,
  tag,
  url,
  buttonLabel
}: {
  title: string;
  tag: string;
  url: string;
  buttonLabel: string;
}) {
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
          {buttonLabel}
        </LinkText>
      </Link>
    </div>
  );
}
