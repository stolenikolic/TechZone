import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import Avatar from "@mui/material/Avatar";
// MUI ICON COMPONENTS
import Edit from "@mui/icons-material/Edit";
import Delete from "@mui/icons-material/Delete";
// GLOBAL CUSTOM COMPONENT
import BazaarSwitch from "components/BazaarSwitch";
// STYLED COMPONENTS
import { StyledTableRow, CategoryWrapper, StyledTableCell, StyledIconButton } from "../styles";

// ========================================================================
interface Category {
  id: string;
  name: string;
  slug: string;
  image: string;
  level: number;
  featured: boolean;
}

type Props = { category: Category };
// ========================================================================

export default function CategoryRow({ category }: Props) {
  const { image, name, level, featured, id, slug } = category;

  const [featuredCategory, setFeaturedCategory] = useState(featured);

  return (
    <StyledTableRow tabIndex={-1} role="checkbox">
      <StyledTableCell align="left">#{id.split("-")[0]}</StyledTableCell>

      <StyledTableCell align="left">
        <CategoryWrapper>{name}</CategoryWrapper>
      </StyledTableCell>

      <StyledTableCell align="left">
        <Avatar variant="rounded">
          <Image
            fill
            alt={name}
            src={image}
            sizes="(100%, 100%)"
            style={{ objectFit: "contain" }}
          />
        </Avatar>
      </StyledTableCell>

      <StyledTableCell align="left">{level}</StyledTableCell>

      <StyledTableCell align="left">
        <BazaarSwitch
          color="info"
          checked={featuredCategory}
          onChange={() => setFeaturedCategory((state) => !state)}
        />
      </StyledTableCell>

      <StyledTableCell align="center">
        <Link href={`/admin/categories/${slug}`}>
          <StyledIconButton>
            <Edit />
          </StyledIconButton>
        </Link>

        <StyledIconButton>
          <Delete />
        </StyledIconButton>
      </StyledTableCell>
    </StyledTableRow>
  );
}
