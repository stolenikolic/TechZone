import { PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Collapse from "@mui/material/Collapse";
// LOCAL CUSTOM COMPONENTS
import ButtonContent from "./button-content";
// STYLED COMPONENTS
import { NavItemButton, ChevronRightIcon, NavExpandRoot } from "../styles";
// CUSTOM DATA MODEL
import { Category } from "models/Common";

// ================================================================
interface Props extends PropsWithChildren {
  item: Category;
}
// ================================================================

export default function SidebarAccordion({ item, children }: Props) {
  const { name, icon } = item;

  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const handleClick = useCallback(() => {
    setCollapsed((state) => !state);
  }, []);

  const isActive = useMemo(() => {
    const findPath = (cat: Category): boolean => {
      if (cat.children) {
        return cat.children.some((child) => child.path === pathname || findPath(child));
      }

      return false;
    };

    return findPath(item);
  }, [item, pathname]);

  useEffect(() => {
    queueMicrotask(() => setCollapsed(isActive));
  }, [isActive]);

  return (
    <NavExpandRoot className="subMenu">
      <NavItemButton
        disableRipple
        disableTouchRipple
        active={isActive}
        onClick={handleClick}
        sx={{ justifyContent: "space-between" }}
      >
        <ButtonContent name={name} icon={icon} />
        <ChevronRightIcon collapsed={collapsed} />
      </NavItemButton>

      <Collapse in={collapsed} unmountOnExit>
        <div className="expansion-panel">{children}</div>
      </Collapse>
    </NavExpandRoot>
  );
}
