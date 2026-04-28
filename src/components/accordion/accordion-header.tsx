import type { ComponentProps } from "react";
import ChevronRight from "icons/ChevronRight";
import { RootContainer } from "./styles";

// =================================================================
interface AccordionHeaderProps extends ComponentProps<typeof RootContainer> {
  open?: boolean;
  showIcon?: boolean;
}
// =================================================================

export default function AccordionHeader({
  sx,
  ref,
  children,
  open = false,
  showIcon = true,
  ...others
}: AccordionHeaderProps) {
  return (
    <RootContainer ref={ref} open={open} sx={sx} {...others}>
      {children}
      {showIcon && <ChevronRight className="caret" />}
    </RootContainer>
  );
}
