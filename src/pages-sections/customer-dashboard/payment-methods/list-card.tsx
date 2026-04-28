"use client";

import Link from "next/link";
import Image from "next/image";
import Card from "@mui/material/Card";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
// CUSTOM COMPONENT
import Trash from "icons/Trash";
import Pencil from "icons/Pencil";
import TableRow from "../table-row";
import FlexBox from "components/flex-box/flex-box";

// ==============================================================
interface Props {
  id: string;
  exp: string;
  card_no: string;
  username: string;
  payment_method: string;
}
// ==============================================================

export default function ListCard({ exp, card_no, payment_method, id, username }: Props) {
  return (
    <TableRow elevation={0}>
      <FlexBox alignItems="center" gap={1.5}>
        <Card sx={{ width: 42, height: 28, borderRadius: 1 }}>
          <Image
            width={42}
            height={30}
            alt={payment_method}
            src={`/assets/images/payment-methods/${payment_method}.svg`}
          />
        </Card>

        <Typography variant="h5">{username}</Typography>
      </FlexBox>

      <Typography variant="body1" textAlign={{ xs: "right", sm: "center" }}>
        {card_no}
      </Typography>

      <Typography variant="body1">{exp}</Typography>

      <Typography variant="body1" color="text.secondary" textAlign="right">
        <IconButton LinkComponent={Link} href={`/payment-methods/${id}`}>
          <Pencil fontSize="small" color="inherit" />
        </IconButton>

        <IconButton
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <Trash fontSize="small" color="error" />
        </IconButton>
      </Typography>
    </TableRow>
  );
}
