import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import Box from "@mui/material/Box";
// MUI ICON COMPONENTS
import Delete from "@mui/icons-material/Delete";
import RemoveRedEye from "@mui/icons-material/RemoveRedEye";
// GLOBAL CUSTOM COMPONENT
import BazaarSwitch from "components/BazaarSwitch";
// STYLED COMPONENTS
import { StyledIconButton, StyledTableCell, StyledTableRow } from "../styles";

// ========================================================================
interface Brand {
  id: string;
  name: string;
  logo: string;
  slug: string;
  featured: boolean;
}

type Props = { brand: Brand };
// ========================================================================

export default function BrandRow({ brand }: Props) {
  const { name, featured, logo, id, slug } = brand;

  const [featuredCategory, setFeaturedCategory] = useState(featured);

  return (
    <StyledTableRow tabIndex={-1} role="checkbox">
      <StyledTableCell align="center">#{id.split("-")[0]}</StyledTableCell>

      <StyledTableCell align="center">{name}</StyledTableCell>

      <StyledTableCell align="center">
        <Box
          sx={{
            width: 55,
            height: 35,
            margin: "auto",
            position: "relative",
            img: { objectFit: "contain" }
          }}
        >
          <Image fill src={logo} alt={name} sizes="(100%, 100%)" />
        </Box>
      </StyledTableCell>

      <StyledTableCell align="center">
        <BazaarSwitch
          color="info"
          checked={featuredCategory}
          onChange={() => setFeaturedCategory((state) => !state)}
        />
      </StyledTableCell>

      <StyledTableCell align="center">
        <Link href={`/admin/categories/${slug}`}>
          <StyledIconButton>
            <RemoveRedEye />
          </StyledIconButton>
        </Link>

        <StyledIconButton>
          <Delete />
        </StyledIconButton>
      </StyledTableCell>
    </StyledTableRow>
  );
}
