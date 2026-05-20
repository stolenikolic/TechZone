import Link from "next/link";
import HomepageImage from "components/homepage-image/homepage-image";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
// STYLED COMPONENT
import { CardContent, ImageContainer, LinkText } from "./styles";

// ===============================================================
interface Props {
  title: string;
  imgUrl: string;
  category: string;
  buttonLink: string;
  buttonLabel: string;
  description: string;
}
// ===============================================================

export default function CarouselCard({
  title,
  category,
  buttonLink,
  buttonLabel,
  description,
  imgUrl
}: Props) {
  return (
    <Grid container spacing={3} sx={{ width: "100%", m: 0, alignItems: "center" }}>
      <Grid size={{ xs: 12, md: 6 }}>
        <CardContent>
          <Typography
            variant="body1"
            fontWeight={500}
            textTransform="uppercase"
            fontSize={{ sm: 18, xs: 16 }}
          >
            {category}
          </Typography>

          <Typography variant="h1" fontWeight={700} fontSize={{ sm: 48, xs: 36 }}>
            {title}
          </Typography>

          <Typography variant="body1" fontSize={{ sm: 18, xs: 14 }} sx={{ maxWidth: 350 }}>
            {description}
          </Typography>

          <Link href={buttonLink}>
            <LinkText variant="body1" fontWeight={500}>
              {buttonLabel}
            </LinkText>
          </Link>
        </CardContent>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <ImageContainer>
          <HomepageImage
            src={imgUrl}
            alt={title}
            width={355}
            height={400}
            style={{
              width: "auto",
              height: "auto",
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain"
            }}
          />
        </ImageContainer>
      </Grid>
    </Grid>
  );
}
