import Link from "next/link";
import Box from "@mui/material/Box";

// ==============================================================
interface Props {
  title: string;
  href: string;
}
// ==============================================================

export default function BoxLink({ href, title }: Props) {
  return (
    <Link href={href}>
      <Box fontWeight={500} borderColor="grey.900" borderBottom="1px solid">
        {title}
      </Box>
    </Link>
  );
}
