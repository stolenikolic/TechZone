import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import HoverBox from "components/HoverBox";
import LazyImage from "components/LazyImage";
// CUSTOM UTILS LIBRARY FUNCTIONS
import { calculateDiscount, formatPrice } from "lib";
// STYLED COMPONENTS
import { CardLink, ItemCard, Price } from "./styles";

// =======================================================
interface Props {
  slug: string;
  price: number;
  title: string;
  imgUrl: string;
  id: string | number;
}
// =======================================================

export default function FrequentlyProductCard({
  slug,
  price,
  title,
  imgUrl = "/assets/images/products/Rectangle 116.png"
}: Props) {
  return (
    <CardLink href={`/products/${slug}`}>
      <ItemCard>
        <HoverBox sx={{ mb: 1.5, borderRadius: 2 }}>
          <LazyImage alt={title} width={500} height={500} src={imgUrl} />
        </HoverBox>

        <Typography noWrap variant="body1" sx={{ mb: 0.5 }}>
          {title}
        </Typography>

        <Price>
          <Typography variant="h6" color="primary">
            {formatPrice(price)}
          </Typography>
          <del>{calculateDiscount(price, 35)}</del>
        </Price>
      </ItemCard>
    </CardLink>
  );
}
