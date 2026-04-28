import Image from "next/image";
import Avatar from "@mui/material/Avatar";
// MUI ICON COMPONENTS
import Edit from "@mui/icons-material/Edit";
import Delete from "@mui/icons-material/Delete";
import RemoveRedEye from "@mui/icons-material/RemoveRedEye";
// GLOBAL CUSTOM COMPONENTS
import FlexBox from "components/flex-box/flex-box";
// STYLED COMPONENTS
import { StatusWrapper, StyledTableRow, StyledTableCell, StyledIconButton } from "../styles";
// CUSTOM UTILS LIBRARY FUNCTION
import { currency } from "lib";
// DATA TYPES
import { RefundRequest } from "./types";

// ========================================================================
type Props = { request: RefundRequest };
// ========================================================================

export default function RefundRequestRow({ request }: Props) {
  const { name, image, orderNo, shopName, amount, status } = request;

  const STYLE = { fontWeight: 400 };

  return (
    <StyledTableRow tabIndex={-1} role="checkbox">
      <StyledTableCell align="left">#{orderNo}</StyledTableCell>

      <StyledTableCell align="left" sx={STYLE}>
        {shopName}
      </StyledTableCell>

      <StyledTableCell align="left">
        <FlexBox alignItems="center" gap={1.5}>
          <Avatar variant="rounded">
            <Image fill src={image} alt={name} sizes="(60px, 60px)" />
          </Avatar>

          <p>{name}</p>
        </FlexBox>
      </StyledTableCell>

      <StyledTableCell align="left" sx={STYLE}>
        {currency(amount)}
      </StyledTableCell>

      <StyledTableCell align="left" sx={STYLE}>
        <StatusWrapper status={status}>{status}</StatusWrapper>
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
