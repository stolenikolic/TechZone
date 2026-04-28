import { Fragment } from "react";
import { Heading, StyledLink } from "./styles";

// ==============================================================
interface Props {
  isDark?: boolean;
  title: string;
  links: { title: string; url: string }[];
}
// ==============================================================

export function FooterLinksWidget({ links, title }: Props) {
  return (
    <Fragment>
      <Heading>{title}</Heading>

      {links.map((item, ind) => (
        <StyledLink href={item.url} key={ind}>
          {item.title}
        </StyledLink>
      ))}
    </Fragment>
  );
}
