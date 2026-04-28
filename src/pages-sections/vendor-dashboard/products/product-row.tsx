import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
// MUI ICON COMPONENTS
import Edit from "@mui/icons-material/Edit";
import Delete from "@mui/icons-material/Delete";
import RemoveRedEye from "@mui/icons-material/RemoveRedEye";
// GLOBAL CUSTOM COMPONENTS
import FlexBox from "components/flex-box/flex-box";
import BazaarSwitch from "components/BazaarSwitch";
// CUSTOM UTILS LIBRARY FUNCTION
import { currency } from "lib";
// STYLED COMPONENTS
import { StyledTableRow, CategoryWrapper, StyledTableCell, StyledIconButton } from "../styles";

// ========================================================================
interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  brand: string;
  image: string;
  category: string;
  published: boolean;
}

type Props = { product: Product };
// ========================================================================

export default function ProductRow({ product }: Props) {
  const { category, name, price, image, brand, id, published, slug } = product;

  const [productPublish, setProductPublish] = useState(published);

  return (
    <StyledTableRow tabIndex={-1} role="checkbox">
      <StyledTableCell align="left">
        <FlexBox alignItems="center" gap={1.5}>
          <Avatar variant="rounded">
            <Image fill src={image} alt={name} sizes="(100%, 100%)" />
          </Avatar>

          <div>
            <Typography variant="h6">{name}</Typography>

            <Typography variant="body1" sx={{ fontSize: 13, color: "grey.600" }}>
              #{id.split("-")[0]}
            </Typography>
          </div>
        </FlexBox>
      </StyledTableCell>

      <StyledTableCell align="left">
        <CategoryWrapper>{category}</CategoryWrapper>
      </StyledTableCell>

      <StyledTableCell align="left">
        <Box sx={{ width: 55, height: 25, position: "relative", img: { objectFit: "contain" } }}>
          <Image fill src={brand} alt={name} sizes="(55px, 25px)" />
        </Box>
      </StyledTableCell>

      <StyledTableCell align="left">{currency(price)}</StyledTableCell>

      <StyledTableCell align="left">
        <BazaarSwitch
          color="info"
          checked={productPublish}
          onChange={() => setProductPublish((state) => !state)}
        />
      </StyledTableCell>

      <StyledTableCell align="center">
        <Link href={`/admin/products/${slug}`}>
          <StyledIconButton>
            <Edit />
          </StyledIconButton>
        </Link>

        <StyledIconButton>
          <RemoveRedEye />
        </StyledIconButton>

        <StyledIconButton>
          <Delete />
        </StyledIconButton>
      </StyledTableCell>
    </StyledTableRow>
  );
}
