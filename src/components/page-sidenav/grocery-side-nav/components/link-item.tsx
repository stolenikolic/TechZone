import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import { NavLink } from "components/nav-link";

// ==============================================================
interface Props {
  ml: number;
  href: string;
  title: string;
}
// ==============================================================

export default function LinkItem({ href, title, ml = 4 }: Props) {
  return (
    <NavLink href={href} color="grey.700">
      <Typography component="span" sx={{ ml, py: 1, display: "block" }}>
        {title}
      </Typography>
    </NavLink>
  );
}
