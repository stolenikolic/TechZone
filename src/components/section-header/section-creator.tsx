import Container from "@mui/material/Container";
import Box, { BoxProps } from "@mui/material/Box";
// LOCAL CUSTOM COMPONENT
import { SectionHeader } from "./section-header";

// ==============================================================
interface Props extends BoxProps {
  title?: string;
  seeMoreLink?: string;
}
// ==============================================================

export function SectionCreator({ title, children, seeMoreLink, ...others }: Props) {
  return (
    <Box mb={7.5} {...others}>
      <Container className="pb-1">
        {title && <SectionHeader title={title} seeMoreLink={seeMoreLink} />}
        {children}
      </Container>
    </Box>
  );
}
