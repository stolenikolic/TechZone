import Link from "next/link";
import Image from "next/image";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
// MUI ICON COMPONENTS
import Edit from "@mui/icons-material/Edit";
import Delete from "@mui/icons-material/Delete";
// STYLED COMPONENTS
import { StyledTableRow, CategoryWrapper, StyledTableCell, StyledIconButton } from "../styles";

// ========================================================================
interface Category {
  id: string;
  name: string;
  slug: string;
  image: string;
  level: number;
  productCount: number;
  topPickCount: number;
}

type Props = { category: Category };
// ========================================================================

export default function CategoryRow({ category }: Props) {
  const { image, name, slug, level, id, productCount, topPickCount } = category;

  return (
    <StyledTableRow tabIndex={-1} role="checkbox">
      <StyledTableCell align="left">#{id.split("-")[0]}</StyledTableCell>

      <StyledTableCell align="left">
        <CategoryWrapper>{name}</CategoryWrapper>
      </StyledTableCell>
      <StyledTableCell align="left">{slug}</StyledTableCell>

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
        {productCount}
      </StyledTableCell>
      <StyledTableCell align="left">
        {topPickCount > 0 ? <Chip size="small" color="info" label={`${topPickCount} Top pick`} /> : "0"}
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
