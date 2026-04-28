import Link from "next/link";
import Typography from "@mui/material/Typography";
// STYLED COMPONENTS
import { Circle, DotListItem } from "../styles";

// ==============================================================
type Item = { title: string; href: string };
// ==============================================================

// RENDER THE NESTED CHILD
export const renderChild = (child: Item[], active: string) => {
  return child.map((item) => (
    <Link href={item.href} key={item.title}>
      <DotListItem active={active === item.title}>
        <Circle className="dot" />
        <Typography component="span">{item.title}</Typography>
      </DotListItem>
    </Link>
  ));
};
