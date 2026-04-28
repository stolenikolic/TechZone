import Link from "next/link";
import Image from "next/image";
// MUI
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import Container from "components/Container";
// STYLED COMPONENTS
import { CardContent, CardRoot } from "./styles";

export default function Section5() {
  return (
    <Container>
      <Grid container spacing={3}>
        <Grid size={{ md: 6, xs: 12 }}>
          <Link href="/products/search">
            <CardRoot>
              <Image
                width={588}
                height={340}
                alt="Summer Collection"
                src="/assets/images/market-1/promo-1.jpg"
              />

              <CardContent>
                <div>
                  <Typography variant="body1" fontSize={24} fontWeight={700}>
                    Summer Collection
                  </Typography>

                  <Typography variant="body1" sx={{ mt: 0.5, maxWidth: 330 }}>
                    Save up to 50% on summer essentials including swimwear, dresses, sandals, and
                    accessories
                  </Typography>
                </div>

                <Button variant="contained" color="primary" size="large">
                  Shop Now
                </Button>
              </CardContent>
            </CardRoot>
          </Link>
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <Link href="/products/search">
            <CardRoot>
              <Image
                width={588}
                height={340}
                alt="Spring Essentials"
                src="/assets/images/market-1/promo-2.jpg"
              />

              <CardContent>
                <div>
                  <Typography variant="body1" fontSize={24} fontWeight={700}>
                    Spring Essentials
                  </Typography>

                  <Typography variant="body1" sx={{ mt: 0.5, maxWidth: 330 }}>
                    Save up to 50% on spring essentials including jackets, rain boots, and seasonal
                    accessories
                  </Typography>
                </div>

                <Button variant="contained" color="primary" size="large">
                  Shop Now
                </Button>
              </CardContent>
            </CardRoot>
          </Link>
        </Grid>
      </Grid>
    </Container>
  );
}
