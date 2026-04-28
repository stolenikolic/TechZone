import { LinkProps } from "next/link";
import type { SxProps, Theme } from "@mui/material/styles";
import ArrowRightAlt from "@mui/icons-material/ArrowRightAlt";
// STYLED COMPONENT
import { StyledLink } from "./styles";

// ==============================================================
interface Props extends Omit<LinkProps, "href"> {
  url: string;
  title: string;
  sx?: SxProps<Theme>;
}
// ==============================================================

export default function IconLink({ url, title, sx }: Props) {
  return (
    <StyledLink href={url} sx={sx}>
      <span>{title}</span>
      <ArrowRightAlt fontSize="small" color="inherit" className="icon" />
    </StyledLink>
  );
}
