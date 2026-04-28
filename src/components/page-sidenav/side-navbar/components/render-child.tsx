import Link from "next/link";
import { Circle, StyledList } from "../styles";

// ==============================================================
type Child = { title: string; href: string };
// ==============================================================

export const renderChild = (child: Child[], active: string) => {
  return child.map(({ title, href }, index) => (
    <Link href={href} key={index}>
      <StyledList active={active === title}>
        <Circle className="dot" />
        <p>{title}</p>
      </StyledList>
    </Link>
  ));
};
