import Link from "next/link";
import { usePathname } from "next/navigation";
// GLOBAL CUSTOM COMPONENT
import OverlayScrollbar from "components/overlay-scrollbar";
// LOCAL CUSTOM COMPONENT
import SidebarAccordion from "./sidebar-accordion";
// LOCAL CUSTOM HOOKS
import { useLayout } from "../dashboard-layout-context";
// SIDEBAR NAVIGATION LIST
import { navigation } from "../dashboard-navigation";
// STYLED COMPONENTS
import {
  ListLabel,
  BadgeValue,
  StyledText,
  BulletIcon,
  ExternalLink,
  NavItemButton,
  ListIconWrapper
} from "./styles";

export default function MultiLevelMenu() {
  const pathname = usePathname();

  const { COMPACT, TOP_HEADER_AREA, handleCloseMobileSidebar } = useLayout();

  // HANDLE ACTIVE CURRENT PAGE
  const activeRoute = (path: string) => (pathname === path ? 1 : 0);

  const renderLevels = (data: any) => {
    return data.map((item: any, index: number) => {
      if (item.type === "label") {
        return (
          <ListLabel key={index} compact={COMPACT}>
            {item.label}
          </ListLabel>
        );
      }

      if (item.children) {
        return (
          <SidebarAccordion key={index} item={item}>
            {renderLevels(item.children)}
          </SidebarAccordion>
        );
      }

      if (item.type === "extLink") {
        return (
          <ExternalLink key={index} href={item.path} rel="noopener noreferrer" target="_blank">
            <NavItemButton key={item.name} name="child" active={0}>
              {item.icon ? (
                <ListIconWrapper>
                  <item.icon />
                </ListIconWrapper>
              ) : (
                <span className="item-icon icon-text">{item.iconText}</span>
              )}

              <StyledText compact={COMPACT}>{item.name}</StyledText>

              {item.badge ? <BadgeValue compact={COMPACT}>{item.badge.value}</BadgeValue> : null}
            </NavItemButton>
          </ExternalLink>
        );
      }

      return (
        <Link key={index} href={item.path} passHref>
          <NavItemButton
            className="navItem"
            active={activeRoute(item.path)}
            onClick={handleCloseMobileSidebar}
          >
            {item?.icon ? (
              <ListIconWrapper>
                <item.icon />
              </ListIconWrapper>
            ) : (
              <BulletIcon active={activeRoute(item.path)} />
            )}

            <StyledText compact={COMPACT}>{item.name}</StyledText>

            {item.badge ? <BadgeValue compact={COMPACT}>{item.badge.value}</BadgeValue> : null}
          </NavItemButton>
        </Link>
      );
    });
  };

  return (
    <OverlayScrollbar
      sx={{ px: 2, overflowX: "hidden", maxHeight: `calc(100vh - ${TOP_HEADER_AREA}px)` }}
    >
      {renderLevels(navigation)}
    </OverlayScrollbar>
  );
}
