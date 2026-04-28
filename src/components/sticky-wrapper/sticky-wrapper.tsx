import { PropsWithChildren, ReactNode } from "react";
import Container from "@mui/material/Container";
// STYLED COMPONENTS
import { ContentWrapper } from "./styles";

// ==============================================================
interface Props extends PropsWithChildren {
  SideNav: ReactNode;
  className?: string;
}
// ==============================================================

export default function StickyWrapper({ SideNav, children, className }: Props) {
  return (
    <Container>
      <ContentWrapper className={className}>
        <div className="sidebar">{SideNav}</div>
        <div className="content">{children}</div>
      </ContentWrapper>
    </Container>
  );
}
