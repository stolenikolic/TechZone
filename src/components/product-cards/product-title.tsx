import Link from "next/link";
import Typography from "@mui/material/Typography";

// ==============================================================
type Props = { title: string; slug: string };
// ==============================================================

export default function ProductTitle({ title, slug }: Props) {
  return (
    <Link href={`/products/${slug}`}>
      <Typography noWrap variant="h6" className="title" color="textSecondary">
        {title}
      </Typography>
    </Link>
  );
}
