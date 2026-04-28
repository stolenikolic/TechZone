import Grid from "@mui/material/Grid";
// GLOBAL CUSTOM COMPONENTS
import Container from "components/Container";
// LOCAL CUSTOM COMPONENTS
import Banners from "./banners";
import CarouselCard from "./carousel-card";
import CarouselBanner from "./carousel-banner";
// API FUNCTIONS
import api from "utils/__api__/market-2";

export default async function Section1() {
  const carouselData = await api.getMainCarouselData();
  if (!carouselData || carouselData.length === 0) return null;

  return (
    <Container>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8, xl: 9 }}>
          <CarouselBanner>
            {carouselData.map((item) => (
              <CarouselCard
                key={item.id}
                title={item.title}
                imgUrl={item.imgUrl}
                category={item.category}
                buttonLink={item.buttonLink}
                description={item.description}
              />
            ))}
          </CarouselBanner>
        </Grid>

        <Grid size={{ xs: 12, lg: 4, xl: 3 }}>
          <Banners />
        </Grid>
      </Grid>
    </Container>
  );
}
