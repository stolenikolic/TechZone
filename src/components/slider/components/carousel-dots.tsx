import { styled, SxProps, Theme } from "@mui/material/styles";
import clsx from "clsx";

type StyledProps = Pick<Props, "activeColor" | "dotColor">;

// STYLED COMPONENT
const DotList = styled("ul", {
  shouldForwardProp: (prop) => prop !== "activeColor" && prop !== "dotColor"
})<StyledProps>(({ theme, activeColor, dotColor }) => ({
  gap: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  "& .carousel-dot": {
    width: 10,
    height: 10,
    borderRadius: 12,
    display: "flex",
    cursor: "pointer",
    transform: "scaleX(1)",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.4s",
    backgroundColor: dotColor || theme.palette.grey[300],
    "&.active": {
      width: 32,
      borderRadius: 8,
      overflow: "hidden",
      position: "relative",
      ":before": {
        content: '""',
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        borderRadius: 8,
        backgroundColor: activeColor || theme.palette.primary.main
      }
    }
  }
}));

// ==============================================================
interface Props {
  sx?: SxProps<Theme>;
  dotColor?: string;
  activeColor?: string;
  scrollSnaps: number[];
  selectedIndex: number;
  onDotButtonClick: (index: number) => void;
}
// ==============================================================

export function CarouselDots({
  sx,
  scrollSnaps,
  selectedIndex,
  dotColor,
  activeColor,
  onDotButtonClick
}: Props) {
  return (
    <DotList sx={sx} activeColor={activeColor} dotColor={dotColor}>
      {scrollSnaps.map((_, index) => (
        <li
          key={index}
          onClick={() => onDotButtonClick(index)}
          className={clsx("carousel-dot", { active: index === selectedIndex })}
        />
      ))}
    </DotList>
  );
}
