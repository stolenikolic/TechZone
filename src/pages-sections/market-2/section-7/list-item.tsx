import Image from "next/image";
import { HtmlHTMLAttributes } from "react";
// MUI
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import { styled, SxProps, Theme } from "@mui/material/styles";

// STYLED COMPONENT
const StyledCard = styled(Card)(() => ({
  gap: ".5rem",
  display: "flex",
  cursor: "pointer",
  alignItems: "center",
  padding: "0.75rem 1rem"
}));

// ==============================================================================
interface Props extends HtmlHTMLAttributes<HTMLElement> {
  title: string;
  imgUrl?: string;
  sx?: SxProps<Theme>;
  isSelected?: boolean;
}
// ==============================================================================

export default function ListItem({ sx, title, imgUrl, isSelected, ...others }: Props) {
  return (
    <StyledCard
      elevation={0}
      sx={{
        backgroundColor: isSelected ? "white" : "action.selected",
        ...sx
      }}
      {...others}
    >
      {imgUrl && (
        <Image
          width={24}
          height={24}
          alt={title}
          src={imgUrl}
          style={{ objectFit: "contain", aspectRatio: 1 }}
        />
      )}

      <Typography noWrap variant="h5" sx={{ lineHeight: 1, textTransform: "capitalize" }}>
        {title}
      </Typography>
    </StyledCard>
  );
}
