import Image from "next/image";
import { useState } from "react";
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
import { StyledIconButton, StyledTableCell, StyledTableRow } from "../styles";
// DATA TYPES
import { Seller } from "./types";

// ========================================================================
type Props = { seller: Seller };
// ========================================================================

export default function SellerRow({ seller }: Props) {
  const { name, phone, image, balance, published, shopName, package: sellerPackage } = seller;

  const [shopPublish, setShopPublish] = useState(published);

  return (
    <StyledTableRow tabIndex={-1} role="checkbox">
      <StyledTableCell align="left">
        <FlexBox alignItems="center" gap={1.5}>
          <Avatar variant="rounded">
            <Image fill sizes="(100%, 100%)" src={image} alt={name} />
          </Avatar>

          <div>
            <Typography variant="h6">{name}</Typography>
            <Typography variant="body1" sx={{ color: "grey.600" }}>
              {phone}
            </Typography>
          </div>
        </FlexBox>
      </StyledTableCell>

      <StyledTableCell align="left">{shopName}</StyledTableCell>

      <StyledTableCell align="left" sx={{ fontWeight: 400 }}>
        {sellerPackage}
      </StyledTableCell>

      <StyledTableCell align="left" sx={{ fontWeight: 400 }}>
        {currency(balance)}
      </StyledTableCell>

      <StyledTableCell align="left">
        <BazaarSwitch
          color="info"
          checked={shopPublish}
          onChange={() => setShopPublish((state) => !state)}
        />
      </StyledTableCell>

      <StyledTableCell align="center">
        <StyledIconButton>
          <Edit />
        </StyledIconButton>

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
