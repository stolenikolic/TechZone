"use client";

import Badge from "@mui/material/Badge";
import { useScrollChromeVisible } from "contexts/ScrollChromeContext";
// GLOBAL CUSTOM HOOK
import useCart from "hooks/useCart";
// GLOBAL CUSTOM COMPONENT
import IconComponent from "components/IconComponent";
// STYLED COMPONENTS
import { NavRow, SafeAreaInset, StyledNavLink, Wrapper } from "./styles";
// CUSTOM DATA MODEL
import { MobileNavItem } from "models/Layout.model";

// ==============================================================
type Props = { navigation: MobileNavItem[] };
// ==============================================================

export function MobileNavigationBar({ navigation }: Props) {
  const { state } = useCart();
  const chromeVisible = useScrollChromeVisible();

  return (
    <Wrapper chromeHidden={!chromeVisible}>
      <NavRow>
        {navigation.map(({ icon, href, title, badge }) => (
          <StyledNavLink href={href} key={title}>
            {badge ? (
              <Badge badgeContent={state.cart.length} color="primary">
                <IconComponent icon={icon} fontSize="small" className="icon" />
              </Badge>
            ) : (
              <IconComponent icon={icon} fontSize="small" className="icon" />
            )}

            {title}
          </StyledNavLink>
        ))}
      </NavRow>
      <SafeAreaInset />
    </Wrapper>
  );
}
