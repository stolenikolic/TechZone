"use client";

import { Fragment } from "react";
import Image from "next/image";
import Box from "@mui/material/Box";
// GLOBAL CUSTOM COMPONENTS
import { Carousel, CarouselArrows, useCarousel } from "components/slider";

const carouselArrowStyles = {
  sx: {
    boxShadow: 0,
    color: "primary.main",
    backgroundColor: "transparent",
    "&:hover": { backgroundColor: "transparent" }
  }
};

interface Props {
  title: string;
  images: string[];
}

export default function ImageCarousel({ images, title }: Props) {
  const { ref, api, arrows } = useCarousel();

  return (
    <Fragment>
      <Carousel ref={ref} api={api}>
        {images!.map((item: string, index: number) => (
          <Box
            key={index}
            height={300}
            sx={{
              display: "flex",
              img: {
                objectFit: "contain",
                objectPosition: "center"
              }
            }}
          >
            <Image fill src={item} alt={title} sizes="100vw" />
          </Box>
        ))}
      </Carousel>

      <CarouselArrows
        onClickNext={arrows.onClickNext}
        onClickPrev={arrows.onClickPrev}
        disableNext={arrows.disableNext}
        disablePrev={arrows.disablePrev}
        slotProps={{
          prev: carouselArrowStyles,
          next: carouselArrowStyles
        }}
      />
    </Fragment>
  );
}
