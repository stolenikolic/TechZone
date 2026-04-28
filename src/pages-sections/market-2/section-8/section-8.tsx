import Image from "next/image";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
// LOCAL CUSTOM COMPONENTS
import BrandCarousel from "./brand-carousel";
// STYLED COMPONENT
import { ImageContainer } from "./styles";
// API FUNCTIONS
import api from "utils/__api__/market-2";

export default async function Section8() {
  const clients = await api.getClients();
  if (!clients || clients.length === 0) return null;

  return (
    <Box bgcolor="grey.50" py={5}>
      <Container>
        <BrandCarousel>
          {clients.map(({ id, image }) => (
            <ImageContainer key={id}>
              <Image fill src={image} alt="brand" sizes="(110px, 50px)" />
            </ImageContainer>
          ))}
        </BrandCarousel>
      </Container>
    </Box>
  );
}
