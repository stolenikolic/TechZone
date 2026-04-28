import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import Container from "components/Container";
import LazyImage from "components/LazyImage";
import SubscribeInput from "components/subscribe-input";
// STYLED COMPONENTS
import { StyledContent, StyledRoot } from "./styles";

export default function Section9() {
  return (
    <Container>
      <StyledRoot>
        <LazyImage
          fill
          priority
          quality={90}
          loading="eager"
          alt="Newsletter Bazaar"
          sizes="(max-width: 768px) 100vw, 1200px"
          src="/assets/images/market-2/newsletter-bg.png"
          sx={{ objectFit: "cover", objectPosition: "center" }}
        />

        <StyledContent>
          <div>
            <Typography variant="body1" fontSize={{ xs: 36, sm: 48 }} fontWeight={700}>
              Newsletter
            </Typography>

            <Typography
              variant="body1"
              fontWeight={500}
              fontSize={{ xs: 14, sm: 16 }}
              lineHeight={{ xs: 1.5, sm: 1.9 }}
            >
              JOIN US & GET A SPECIAL WELCOME GIFT
            </Typography>
          </div>

          <SubscribeInput fullWidth />
        </StyledContent>
      </StyledRoot>
    </Container>
  );
}
