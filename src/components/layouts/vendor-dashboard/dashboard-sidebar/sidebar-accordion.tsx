import { PropsWithChildren, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import { styled } from "@mui/material/styles";
// LOCAL CUSTOM HOOK
import { useLayout } from "../dashboard-layout-context";
// STYLED COMPONENTS
import {
  BadgeValue,
  BulletIcon,
  StyledText,
  NavItemButton,
  ListIconWrapper,
  ChevronRightIcon
} from "./styles";

// STYLED COMPONENT
const NavExpandRoot = styled("div")({
  "& .expansion-panel": {
    overflow: "hidden",
    "& .expansion-panel": { paddingLeft: 8 }
  }
});

// ================================================================
interface Props extends PropsWithChildren {
  item: any;
}
// ================================================================

export default function SidebarAccordion({ item, children }: Props) {
  const { name, icon, iconText, badge } = item || {};

  const { COMPACT } = useLayout();
  const pathname = usePathname();

  const hasActiveChild = useMemo(
    () => item?.children?.some((li: any) => li.path === pathname),
    [item?.children, pathname]
  );

  const [collapsed, setCollapsed] = useState(() => hasActiveChild as boolean);

  const handleClick = () => setCollapsed((state) => !state);

  useEffect(() => {
    if (hasActiveChild) {
      queueMicrotask(() => setCollapsed(true));
    }
  }, [hasActiveChild]);

  useEffect(() => {
    if (COMPACT) {
      queueMicrotask(() => setCollapsed(false));
    }
  }, [COMPACT]);

  return (
    <NavExpandRoot className="subMenu">
      <NavItemButton
        onClick={handleClick}
        active={hasActiveChild ? 1 : 0}
        sx={{ justifyContent: "space-between" }}
      >
        <Box display="flex" alignItems="center">
          {icon ? (
            <ListIconWrapper>
              <item.icon />
            </ListIconWrapper>
          ) : null}

          {iconText ? <BulletIcon active={hasActiveChild ? 1 : 0} /> : null}

          <StyledText compact={COMPACT}>{name}</StyledText>
        </Box>

        {badge ? <BadgeValue compact={COMPACT}>{badge.value}</BadgeValue> : null}

        <ChevronRightIcon color="disabled" compact={COMPACT} collapsed={collapsed ? 1 : 0} />
      </NavItemButton>

      <Collapse in={collapsed} unmountOnExit>
        <div className="expansion-panel">{children}</div>
      </Collapse>
    </NavExpandRoot>
  );
}
