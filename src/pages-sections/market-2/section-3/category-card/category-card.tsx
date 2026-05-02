import Link from "next/link";
import Typography from "@mui/material/Typography";
import LazyImage from "components/LazyImage";
import { ImageContainer, StyledRoot } from "./styles";

// ============================================================
interface Props {
  image: string | null;
  title: string;
  slug: string;
}
// ============================================================

export default function CategoryCard({ image, title, slug }: Props) {
  const hasImage = image && image.trim() !== "";
  return (
    <Link href={`/categories/${slug}`}>
      <StyledRoot>
        <ImageContainer>
          {hasImage ? (
            <LazyImage alt={title} width={180} height={180} src={image!} className="category-image" />
          ) : (
            <div
              className="category-placeholder"
              style={{
                background: "#f0f0f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#999",
                fontSize: 14
              }}
              aria-hidden
            >
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
