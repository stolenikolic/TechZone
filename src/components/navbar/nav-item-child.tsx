import { PropsWithChildren } from "react";
import { usePathname } from "next/navigation";
// MUI
import Card from "@mui/material/Card";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
// ICON COMPONENTS
import ChevronRight from "icons/ChevronRight";
// GLOBAL CUSTOM HOOKS
import useOverflowDetect from "hooks/useOverflowDetect";
// STYLED COMPONENTS
import { ParentNav, ParentNavItem } from "./styles";
// DATA TYPES
import { MenuItemWithChild } from "models/Navigation.model";

// ==============================================================
interface Props extends PropsWithChildren {
  nav: MenuItemWithChild;
}
// ==============================================================

export default function NavItemChild({ nav, children }: Props) {
  const pathname = usePathname();
  const { checkOverflow, elementRef, isRightOverflowing } = useOverflowDetect();

  const isActive = nav.child!.flat().find((item) => item.url === pathname);

  return (
    <ParentNav minWidth={200} active={isActive ? 1 : 0} onMouseEnter={checkOverflow}>
      <MenuItem color="grey.700">
        <Typography component="span" sx={{ flex: "1 1 0" }}>
          {nav.title}
        </Typography>

        <ChevronRight className="arrow" />
      </MenuItem>

      <ParentNavItem ref={elementRef} right={isRightOverflowing} className="parent-nav-item">
        <Card elevation={5} sx={{ py: "0.5rem", minWidth: 180, overflow: "unset" }}>
          {children}
        </Card>
      </ParentNavItem>
    </ParentNav>
  );
}
