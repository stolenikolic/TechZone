import Grid from "@mui/material/Grid";
// GLOBAL CUSTOM COMPONENTS
import Container from "components/Container";
// LOCAL CUSTOM COMPONENTS
import Banners from "./banners";
import CarouselCard from "./carousel-card";
import CarouselBanner from "./carousel-banner";
import { loadActiveHomepage } from "lib/homepage/load-homepage";

export default async function Section1() {
  const { heroCarousel, heroSide } = await loadActiveHomepage(true);
  if (heroCarousel.length === 0 && heroSide.length === 0) return null;

  return (
    <Container>
      <Grid container spacing={3} sx={{ width: "100%", m: 0 }}>
        {heroCarousel.length > 0 ? (
          <Grid size={{ xs: 12, lg: 8, xl: 9 }}>
            <CarouselBanner>
              {heroCarousel.map((item) => (
                <CarouselCard
                  key={item.id}
                  title={item.title}
                  imgUrl={item.imgUrl}
                  category={item.category}
                  buttonLink={item.buttonLink}
                  buttonLabel={item.buttonLabel}
                  description={item.description}
                />
              ))}
            </CarouselBanner>
          </Grid>
        ) : null}

        {heroSide.length > 0 ? (
          <Grid size={{ xs: 12, lg: 4, xl: 3 }}>
            <Banners items={heroSide} />
          </Grid>
        ) : null}
      </Grid>
    </Container>
  );
}
