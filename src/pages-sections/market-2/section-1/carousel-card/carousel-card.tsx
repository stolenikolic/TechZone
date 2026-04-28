import Link from "next/link";
import Image from "next/image";
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
  description: string;
}
// ===============================================================

export default function CarouselCard({ title, category, buttonLink, description, imgUrl }: Props) {
  return (
    <Grid container spacing={3}>
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
              EXPLORE NOW
            </LinkText>
          </Link>
        </CardContent>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <ImageContainer>
          <Image src={imgUrl} alt={title} width={355} height={400} />
        </ImageContainer>
      </Grid>
    </Grid>
  );
}
