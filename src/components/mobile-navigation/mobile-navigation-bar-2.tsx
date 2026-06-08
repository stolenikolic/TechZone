"use client";

import { Fragment, PropsWithChildren, useState } from "react";
import Badge from "@mui/material/Badge";
import { useScrollChromeVisible } from "contexts/ScrollChromeContext";
// GLOBAL CUSTOM HOOKS
import useCart from "hooks/useCart";
// STYLED COMPONENTS
import { NavRow, SafeAreaInset, StyledBox, StyledDrawer, StyledNavLink, Wrapper } from "./styles";
// TYPES
import Item from "./types";

// ==============================================================
interface Props extends PropsWithChildren {
  navigation: Item[];
}
// ==============================================================

export function MobileNavigationBar2({ children, navigation }: Props) {
  const { state } = useCart();
  const chromeVisible = useScrollChromeVisible();
  const [open, setOpen] = useState(false);

  const handleDrawerClose = () => setOpen(false);
  const handleDrawerToggle = () => setOpen((state) => !state);

  return (
    <Fragment>
      <StyledDrawer open={open} anchor="left" onClose={handleDrawerClose}>
        {children}
      </StyledDrawer>

      <Wrapper chromeHidden={!chromeVisible}>
        <NavRow>
        {navigation.map(({ Icon, title, href, badge }) => {
          // LINK INNER CONTENTS
          const ICON = <Icon className="icon" fontSize="small" />;

          const CONTENT = (
            <Fragment>
              {badge ? (
                <Badge badgeContent={state.cart.length} color="primary">
                  {ICON}
                </Badge>
              ) : (
                ICON
              )}

              {title}
            </Fragment>
          );

          return href ? (
            <StyledNavLink key={title} href={href}>
              {CONTENT}
            </StyledNavLink>
          ) : (
            <StyledBox key={title} onClick={handleDrawerToggle}>
              {CONTENT}
            </StyledBox>
          );
        })}
        </NavRow>
        <SafeAreaInset />
      </Wrapper>
    </Fragment>
  );
}
