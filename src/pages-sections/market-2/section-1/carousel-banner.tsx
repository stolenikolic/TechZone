"use client";

import type { PropsWithChildren } from "react";
import AutoPlay from "embla-carousel-autoplay";
import Box from "@mui/material/Box";
// GLOBAL CUSTOM COMPONENTS
import { Carousel, useCarousel, CarouselDots } from "components/slider";

const SLIDE_MIN_HEIGHT = { xs: 400, md: 440 };

export default function CarouselBanner({ children }: PropsWithChildren) {
  const { ref, api, dots } = useCarousel({ loop: true }, [AutoPlay({ delay: 3000 })]);

  return (
    <Box bgcolor="grey.50" borderRadius={3} px={{ xs: 3, sm: 6 }} py={{ xs: 3, sm: 4 }}>
      <Box
        sx={{
          minHeight: SLIDE_MIN_HEIGHT,
          "& .carousel-root": { minHeight: SLIDE_MIN_HEIGHT },
          "& .carousel-container": { alignItems: "stretch" },
          "& .carousel-slide": {
            minHeight: SLIDE_MIN_HEIGHT,
            display: "flex",
            alignItems: "stretch"
          },
          "& .carousel-slide > *": {
            width: "100%",
            minHeight: SLIDE_MIN_HEIGHT
          }
        }}
      >
        <Carousel ref={ref} api={api}>
          {children}
        </Carousel>
      </Box>

      <CarouselDots
        scrollSnaps={dots.scrollSnaps}
        selectedIndex={dots.selectedIndex}
        onDotButtonClick={dots.onDotButtonClick}
      />
    </Box>
  );
}
