import { styled, SxProps, Theme } from "@mui/material/styles";
import SvgIcon from "@mui/material/SvgIcon";

// STYLED COMPONENT
const ArrowButton = styled("button")(({ theme }) => ({
  all: "unset",
  zIndex: 1,
  width: 35,
  height: 35,
  padding: 0,
  opacity: 1,
  top: "50%",
  borderRadius: 10,
  display: "flex",
  cursor: "pointer",
  position: "absolute",
  alignItems: "center",
  justifyContent: "center",
  transform: "translate(0, -50%)",
  transition: "all 0.2s ease-in-out",
  color: theme.palette.common.white,
  backgroundColor: theme.palette.primary.main,
  boxShadow: "0px 10px 30px rgba(0, 0, 0, 0.1)",
  "&.prev": { left: 5 },
  "&.next": { right: 5 },
  ":disabled": {
    opacity: 0.5,
    cursor: "default"
  },
  ...(theme.direction === "rtl" && {
    ".back-icon, .forward-icon": { rotate: "180deg" }
  })
}));

// ==============================================================
interface Props {
  disablePrev?: boolean;
  disableNext?: boolean;
  onClickPrev: () => void;
  onClickNext: () => void;
  slotProps?: {
    prev?: { sx?: SxProps<Theme> };
    next?: { sx?: SxProps<Theme> };
  };
}
// ==============================================================

export function CarouselArrows({
  slotProps,
  disablePrev,
  disableNext,
  onClickPrev,
  onClickNext
}: Props) {
  return (
    <>
      <ArrowButton
        className="prev"
        disabled={disablePrev}
        onClick={onClickPrev}
        sx={slotProps?.prev?.sx}
      >
        <SvgIcon fontSize="small" color="inherit" className="back-icon">
          <path
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
            d="M15.488 4.43a.75.75 0 0 1 .081 1.058L9.988 12l5.581 6.512a.75.75 0 1 1-1.138.976l-6-7a.75.75 0 0 1 0-.976l6-7a.75.75 0 0 1 1.057-.081"
          />
        </SvgIcon>
      </ArrowButton>

      <ArrowButton
        className="next"
        disabled={disableNext}
        onClick={onClickNext}
        sx={slotProps?.next?.sx}
      >
        <SvgIcon fontSize="small" color="inherit" className="forward-icon">
          <path
            fill="currentColor"
            clipRule="evenodd"
            fillRule="evenodd"
            d="M8.512 4.43a.75.75 0 0 1 1.057.082l6 7a.75.75 0 0 1 0 .976l-6 7a.75.75 0 0 1-1.138-.976L14.012 12L8.431 5.488a.75.75 0 0 1 .08-1.057"
          />
        </SvgIcon>
      </ArrowButton>
    </>
  );
}
