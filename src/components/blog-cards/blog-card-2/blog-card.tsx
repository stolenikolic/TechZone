import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns/format";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENT
import IconLink from "components/icon-link";
// STYLED COMPONENTS
import { ContentWrapper, ImageContainer, StyledRoot } from "./styles";

// ==============================================================
interface Props {
  date: string;
  title: string;
  thumbnail: string;
  description: string;
  link?: string;
}
// ==============================================================

export default function BlogCard2({ title, date, description, thumbnail, link = "#" }: Props) {
  return (
    <StyledRoot>
      <Link href={link}>
        <ImageContainer>
          <Image fill alt={title} src={thumbnail} />
        </ImageContainer>
      </Link>

      <ContentWrapper>
        <Typography variant="body1" sx={{ mb: 1 }}>
          {format(new Date(date), "dd MMMM, yyyy")}
        </Typography>

        <Link href={link}>
          <Typography variant="h3" fontSize={22} fontWeight={700}>
            {title}
          </Typography>
        </Link>

        <Typography variant="body1" fontSize={16} className="description">
          {description}
        </Typography>

        <IconLink title="Read More" url="#" />
      </ContentWrapper>
    </StyledRoot>
  );
}
