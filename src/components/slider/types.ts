import type { PropsWithChildren } from "react";
import type { SxProps, Theme } from "@mui/material/styles";
import type { EmblaViewportRefType } from "embla-carousel-react";
import type { EmblaOptionsType, EmblaCarouselType } from "embla-carousel";

export interface CarouselBaseOptions extends EmblaOptionsType {
  slideSpacing?: string;
  slidesToShow?: string | number | { [key: string]: string | number };
}

export interface CarouselOptions extends CarouselBaseOptions {
  breakpoints?: {
    [key: string]: Omit<CarouselBaseOptions, "slidesToShow">;
  };
}

export interface CarouselProps extends PropsWithChildren {
  plugins?: string[];
  sx?: SxProps<Theme>;
  api?: EmblaCarouselType;
  ref: EmblaViewportRefType;
  options?: CarouselOptions;
  slotProps?: {
    slide?: SxProps<Theme>;
    container?: SxProps<Theme>;
  };
}

export interface CarouselSlideProps extends PropsWithChildren {
  options?: Partial<CarouselOptions>;
  sx?: SxProps<Theme>;
}
