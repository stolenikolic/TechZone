import Link from "next/link";
import Typography from "@mui/material/Typography";
import LazyImage from "components/LazyImage";
import { ImageContainer, StyledRoot } from "./styles";

interface Props {
  image: string | null;
  title: string;
  slug: string;
}

export default function CategoryCard({ image, title, slug }: Props) {
  const hasImage = image && image.trim() !== "";
  return (
    <Link href={`/categories/${slug}`}>
      <StyledRoot>
        <ImageContainer>
          {hasImage ? (
            <LazyImage
              alt={title}
              fill
              sizes="(max-width: 600px) 50vw, (max-width: 1200px) 20vw, 180px"
              src={image!}
              className="category-image"
            />
          ) : (
            <div className="category-placeholder" aria-hidden>
              Category
            </div>
          )}
        </ImageContainer>

        <Typography variant="body1" fontSize={17} fontWeight={500} className="title">
          {title}
        </Typography>
      </StyledRoot>
    </Link>
  );
}
