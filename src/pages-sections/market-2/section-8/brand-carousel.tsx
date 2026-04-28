"use client";

import { type PropsWithChildren } from "react";
import Autoplay from "embla-carousel-autoplay";
import { Carousel, useCarousel } from "components/slider";

export default function BrandCarousel({ children }: PropsWithChildren) {
  const { ref, api, options } = useCarousel(
    {
      loop: true,
      align: "center",
      slideSpacing: "1.5rem",
      slidesToShow: { xs: 1, sm: 2, md: 3, lg: 5 }
    },
    [Autoplay({ delay: 4000 })]
  );

  return (
    <Carousel ref={ref} api={api} options={options}>
      {children}
    </Carousel>
  );
}
