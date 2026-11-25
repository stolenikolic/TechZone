import Link from "next/link";
import Typography from "@mui/material/Typography";
import LazyImage from "components/LazyImage";
import ChevronRight from "icons/ChevronRight";
import { ImageBox, RowLink } from "./styles";

interface Props {
  image: string | null;
  title: string;
  slug: string;
  href?: string;
}

export default function SubcategoryRow({ image, title, slug, href }: Props) {
  const hasImage = Boolean(image && image.trim() !== "");

  return (
    <RowLink href={href ?? `/kategorije/${slug}`}>
      <ImageBox>
        {hasImage ? (
          <LazyImage alt="" fill sizes="64px" src={image!} className="thumb" />
        ) : (
          <span className="placeholder" aria-hidden>
            {title.slice(0, 1)}
          </span>
        )}
      </ImageBox>

      <Typography component="span" className="title">
        {title}
      </Typography>

      <ChevronRight className="caret" fontSize="small" />
    </RowLink>
  );
}
