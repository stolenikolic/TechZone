import LazyImage from "components/LazyImage";
import { CategoryTitle, Wrapper } from "./styles";

// ============================================================
interface Props {
  image: string;
  title: string;
}
// ============================================================

export default function CategoryCard1({ image, title }: Props) {
  return (
    <Wrapper>
      <LazyImage src={image} width={213} height={213} alt="category" />

      <CategoryTitle className="category-title">
        <p>{title}</p>
      </CategoryTitle>
    </Wrapper>
  );
}
