"use client";

import type { PropsWithChildren } from "react";
import { Carousel, useCarousel } from "components/slider";
// MUI
import SvgIcon from "@mui/material/SvgIcon";
import ButtonBase from "@mui/material/ButtonBase";
import { styled } from "@mui/material/styles";

const StyledButtonBase = styled(ButtonBase)({
  width: 32,
  height: 32,
  top: "50%",
  opacity: 0,
  borderRadius: 6,
  position: "absolute",
  transform: "translateY(-50%)",
  transition: "all 0.3s ease-in-out"
});

export default function ImageCarousel({ children }: PropsWithChildren) {
  const { ref, api, arrows } = useCarousel({ loop: true });

  return (
    <>
      <Carousel ref={ref} api={api}>
        {children}
      </Carousel>

      <StyledButtonBase
        className="prev-btn"
        disabled={arrows.disablePrev}
        onClick={arrows.onClickPrev}
        sx={{ left: 5 }}
      >
        <SvgIcon>
          <path fill="currentColor" d="M14 17.308L8.692 12L14 6.692l.708.708l-4.6 4.6l4.6 4.6z" />
        </SvgIcon>
      </StyledButtonBase>

      <StyledButtonBase
        className="next-btn"
        disabled={arrows.disableNext}
        onClick={arrows.onClickNext}
        sx={{ right: 5 }}
      >
        <SvgIcon>
          <path
            fill="currentColor"
            d="m13.292 12l-4.6-4.6l.708-.708L14.708 12L9.4 17.308l-.708-.708z"
          />
        </SvgIcon>
      </StyledButtonBase>
    </>
  );
}
