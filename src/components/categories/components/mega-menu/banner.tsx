import Link from "next/link";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import LazyImage from "components/LazyImage";
import FlexBox from "components/flex-box/flex-box";

export default function OfferBanner() {
  return (
    <Link href="/sale-page-2">
      <Grid
        container
        mb={-1}
        spacing={0}
        className="h-full"
        wrap="wrap-reverse"
        alignItems="center"
      >
        <Grid size={{ sm: 6, xs: 12 }}>
          <Box px={2.5}>
            <Typography variant="h3" sx={{ mb: 1 }}>
              Big Sale Upto 60% Off
            </Typography>

            <Typography variant="body1" sx={{ mb: 1, color: "grey.600" }}>
              Handcrafted from genuine Italian Leather
            </Typography>

            <Typography
              component="span"
              sx={{
                fontSize: 12,
                fontWeight: 600,
                borderBottom: "2px solid",
                borderColor: "primary.main"
              }}
            >
              SHOP NOW
            </Typography>
          </Box>
        </Grid>

        <Grid size={{ sm: 6, xs: 12 }}>
          <FlexBox
            height="160px"
            position="relative"
            flexDirection="column"
            justifyContent="flex-end"
          >
            <LazyImage
              alt="model"
              width={292}
              height={195}
              src="/assets/images/models/model-1.png"
            />
          </FlexBox>
        </Grid>
      </Grid>
    </Link>
  );
}
