import Grid from "@mui/material/Grid";
import Divider from "@mui/material/Divider";
import Container from "components/Container";
// CUSTOM UTILS LIBRARY FUNCTION
import { formatPrice } from "lib";
// STYLED COMPONENT
import { BannerBox } from "./styles";

export default function Section6() {
  return (
    <Container>
      <Grid container spacing={3}>
        <Grid size={{ sm: 6, xs: 12 }}>
          <BannerBox img="/assets/images/banners/banner-21.jpg">
            <p className="subtitle">Final Reduction</p>
            <h3 className="title">Sale up to 20% Off</h3>
            <Divider />

            <p className="price">
              Only From <span>{formatPrice(270)}</span>
            </p>
          </BannerBox>
        </Grid>

        <Grid size={{ sm: 6, xs: 12 }}>
          <BannerBox className="text-white" img="/assets/images/banners/banner-22.jpg">
            <p className="subtitle">Weekend Sale</p>
            <h3 className="title">Fine Smart Speaker</h3>
            <Divider />
            <p className="price">
              Starting at <span>{formatPrice(185)}</span>
            </p>
          </BannerBox>
        </Grid>
      </Grid>
    </Container>
  );
}
