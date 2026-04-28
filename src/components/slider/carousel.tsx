"use client";

import { Children, isValidElement } from "react";
import { styled } from "@mui/material/styles";

import { CarouselSlide } from "./components/carousel-slide";
import type { CarouselProps, CarouselOptions } from "./types";

type StyledProps = Pick<CarouselOptions, "axis" | "slideSpacing">;

export const StyledRoot = styled("div", {
  shouldForwardProp: (prop) => prop !== "axis"
})<StyledProps>(({ axis }) => ({
  margin: "auto",
  maxWidth: "100%",
  overflow: "hidden",
  position: "relative",
  ...(axis === "y" && { height: "100%" })
}));

export const StyledContainer = styled("ul", {
  shouldForwardProp: (prop) => prop !== "axis" && prop !== "slideSpacing"
})<StyledProps>(({ axis, slideSpacing }) => ({
  display: "flex",
  backfaceVisibility: "hidden",
  ...(axis === "x" && {
    touchAction: "pan-y pinch-zoom",
    marginLeft: `calc(${slideSpacing} * -1)`
  }),
  ...(axis === "y" && {
    height: "100%",
    flexDirection: "column",
    touchAction: "pan-x pinch-zoom",
    marginTop: `calc(${slideSpacing} * -1)`
  })
}));

export function Carousel({ sx, ref, options, children, slotProps }: CarouselProps) {
  const axis = options?.axis ?? "x";
  const direction = options?.direction ?? "ltr";
  const slideSpacing = options?.slideSpacing ?? "0px";

  const renderChildren = Children.map(children, (child) => {
    if (isValidElement(child)) {
      const reactChild = child as React.ReactElement<{ key?: React.Key }>;
      return (
        <CarouselSlide key={reactChild.key} options={options} sx={slotProps?.slide}>
          {child}
        </CarouselSlide>
      );
    }

    return null;
  });

  return (
    <StyledRoot sx={sx} axis={axis} ref={ref} dir={direction} className="carousel-root">
      <StyledContainer axis={axis} slideSpacing={slideSpacing} className="carousel-container">
        {renderChildren}
      </StyledContainer>
    </StyledRoot>
  );
}
