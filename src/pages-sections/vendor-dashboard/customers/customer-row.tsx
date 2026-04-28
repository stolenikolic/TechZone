import Image from "next/image";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
// MUI ICON COMPONENTS
import Edit from "@mui/icons-material/Edit";
import Delete from "@mui/icons-material/Delete";
// GLOBAL CUSTOM COMPONENTS
import FlexBox from "components/flex-box/flex-box";
// CUSTOM UTILS LIBRARY FUNCTION
import { currency } from "lib";
// STYLED COMPONENTS
import { StyledIconButton, StyledTableCell, StyledTableRow } from "../styles";

// ========================================================================
type Props = { customer: any };
// ========================================================================

export default function CustomerRow({ customer }: Props) {
  const { email, name, phone, avatar, balance, orders } = customer;

  const STYLE = { fontWeight: 400 };

  return (
    <StyledTableRow tabIndex={-1} role="checkbox">
      <StyledTableCell align="left">
        <FlexBox alignItems="center" gap={1.5}>
          <Avatar variant="rounded">
            <Image fill src={avatar} alt={name} sizes="(60px, 60px)" />
          </Avatar>

          <Typography variant="h6">{name}</Typography>
        </FlexBox>
      </StyledTableCell>

      <StyledTableCell align="left" sx={STYLE}>
        {phone}
      </StyledTableCell>

      <StyledTableCell align="left" sx={STYLE}>
        {email}
      </StyledTableCell>

      <StyledTableCell align="left" sx={STYLE}>
        {currency(balance)}
      </StyledTableCell>

      <StyledTableCell align="left" sx={STYLE}>
        {orders}
      </StyledTableCell>

      <StyledTableCell align="center">
        <StyledIconButton>
          <Edit />
        </StyledIconButton>

        <StyledIconButton>
          <Delete />
        </StyledIconButton>
      </StyledTableCell>
    </StyledTableRow>
  );
}
