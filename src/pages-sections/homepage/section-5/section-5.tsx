import Link from "next/link";
import HomepageImage from "components/homepage-image/homepage-image";
// MUI
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import Container from "components/Container";
import { loadActiveHomepage } from "lib/homepage/load-homepage";
// STYLED COMPONENTS
import { CardContent, CardRoot } from "./styles";

export default async function Section5() {
  const { promo } = await loadActiveHomepage(true);
  if (!promo.length) return null;

  return (
    <Container>
      <Grid container spacing={3} sx={{ width: "100%", m: 0 }}>
        {promo.map((item) => (
          <Grid size={{ md: 6, xs: 12 }} key={item.id}>
            <Link href={item.buttonLink}>
              <CardRoot>
                <HomepageImage width={588} height={340} alt={item.title} src={item.imgUrl} />

                <CardContent>
                  <div>
                    <Typography variant="body1" fontSize={24} fontWeight={700}>
                      {item.title}
                    </Typography>

                    <Typography variant="body1" sx={{ mt: 0.5, maxWidth: 330 }}>
                      {item.description}
                    </Typography>
                  </div>

                  <Button variant="contained" color="primary" size="large">
                    {item.buttonLabel}
                  </Button>
                </CardContent>
              </CardRoot>
            </Link>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
