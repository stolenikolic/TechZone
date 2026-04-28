import { styled } from "@mui/material/styles";
import type { CarouselOptions, CarouselSlideProps } from "../types";

type StyledProps = Pick<CarouselOptions, "axis" | "slideSpacing">;

const StyledRoot = styled("li", {
  shouldForwardProp: (prop) => prop !== "axis" && prop !== "slideSpacing"
})<StyledProps>(({ axis, slideSpacing }) => ({
  display: "block",
  position: "relative",
  ...(axis === "x" && {
    minWidth: 0,
    paddingLeft: slideSpacing
  }),
  ...(axis === "y" && {
    minHeight: 0,
    paddingTop: slideSpacing
  })
}));

export function CarouselSlide({ sx, options, children, ...other }: CarouselSlideProps) {
  const slideSize = getSize(options?.slidesToShow);

  return (
    <StyledRoot
      className="carousel-slide"
      axis={options?.axis ?? "x"}
      slideSpacing={options?.slideSpacing}
      sx={{ flex: slideSize, ...sx }}
      {...other}
    >
      {children}
    </StyledRoot>
  );
}

type ObjectValue = {
  [key: string]: string | number;
};

type InputValue = CarouselOptions["slidesToShow"];

function getSize(slidesToShow: InputValue): InputValue {
  if (slidesToShow && typeof slidesToShow === "object") {
    return Object.keys(slidesToShow).reduce<ObjectValue>((acc, key) => {
      const sizeByKey = slidesToShow[key];
      acc[key] = getValue(sizeByKey);
      return acc;
    }, {});
  }

  return getValue(slidesToShow);
}

function getValue(value: string | number = 1): string {
  if (typeof value === "string") {
    const isSupported = value === "auto" || value.endsWith("%") || value.endsWith("px");
    if (!isSupported) {
      throw new Error(`Only accepts values: auto, px, %, or number.`);
    }
    // value is either 'auto', ends with '%', or ends with 'px'
    return `0 0 ${value}`;
  }

  if (typeof value === "number") {
    return `0 0 ${100 / value}%`;
  }

  // Default case should not be reached due to the type signature, but we include it for safety
  throw new Error(`Invalid value type. Only accepts values: auto, px, %, or number.`);
}
