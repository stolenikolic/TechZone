"use client";

import type { PropsWithChildren } from "react";
import AutoPlay from "embla-carousel-autoplay";
import Box from "@mui/material/Box";
// GLOBAL CUSTOM COMPONENTS
import { Carousel, useCarousel, CarouselDots } from "components/slider";

export default function CarouselBanner({ children }: PropsWithChildren) {
  const { ref, api, dots } = useCarousel({ loop: true }, [AutoPlay({ delay: 3000 })]);

  return (
    <Box bgcolor="grey.50" borderRadius={3} px={{ xs: 3, sm: 6 }} py={{ xs: 3, sm: 4 }}>
      <Carousel ref={ref} api={api}>
        {children}
      </Carousel>

      <CarouselDots
        scrollSnaps={dots.scrollSnaps}
        selectedIndex={dots.selectedIndex}
        onDotButtonClick={dots.onDotButtonClick}
      />
    </Box>
  );
}
