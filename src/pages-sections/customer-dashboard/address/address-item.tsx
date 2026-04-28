import Link from "next/link";
// MUI
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
// CUSTOM COMPONENTS
import Pencil from "icons/Pencil";
import TableRow from "../table-row";
import DeleteAddressBtn from "./delete-btn";
// CUSTOM DATA MODEL
import Address from "models/Address.model";

// ==============================================================
type Props = { address: Address };
// ==============================================================

export default function AddressListItem({ address }: Props) {
  return (
    <Link href={`/address/${address.id}`}>
      <TableRow elevation={0}>
        <Typography noWrap fontWeight={500} variant="body1">
          {address.title}
        </Typography>

        <Typography noWrap variant="body1">
          {`${address.street}, ${address.city}`}
        </Typography>

        <Typography noWrap variant="body1">
          {address.phone}
        </Typography>

        <Typography noWrap variant="body1" color="text.secondary" textAlign="right">
          <IconButton>
            <Pencil fontSize="small" color="inherit" />
          </IconButton>

          <DeleteAddressBtn id={address.id} />
        </Typography>
      </TableRow>
    </Link>
  );
}
