import Link from "next/link";
import { format } from "date-fns/format";
// MUI ICON COMPONENTS
import Delete from "@mui/icons-material/Delete";
import RemoveRedEye from "@mui/icons-material/RemoveRedEye";
// CUSTOM UTILS LIBRARY FUNCTION
import { currency } from "lib";
// STYLED COMPONENTS
import { StatusWrapper, StyledIconButton, StyledTableCell, StyledTableRow } from "../styles";

// ========================================================================
type Props = { order: any };
// ========================================================================

export default function OrderRow({ order }: Props) {
  const { amount, id, qty, purchaseDate, billingAddress, status } = order;

  return (
    <StyledTableRow tabIndex={-1} role="checkbox">
      <StyledTableCell align="left">#{id.split("-")[0]}</StyledTableCell>
      <StyledTableCell align="left">{qty}</StyledTableCell>

      <StyledTableCell align="left" sx={{ fontWeight: 400 }}>
        {format(new Date(purchaseDate), "dd MMM yyyy")}
      </StyledTableCell>

      <StyledTableCell align="left" sx={{ fontWeight: 400 }}>
        {billingAddress}
      </StyledTableCell>

      <StyledTableCell align="left">{currency(amount)}</StyledTableCell>

      <StyledTableCell align="left">
        <StatusWrapper status={status}>{status}</StatusWrapper>
      </StyledTableCell>

      <StyledTableCell align="center">
        <Link href={`/admin/orders/${id}`}>
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
