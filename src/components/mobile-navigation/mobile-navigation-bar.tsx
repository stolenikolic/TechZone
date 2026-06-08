"use client";

import Badge from "@mui/material/Badge";
import Avatar from "@mui/material/Avatar";
import { useScrollChromeVisible } from "contexts/ScrollChromeContext";
import { useAuth } from "contexts/AuthContext";
// GLOBAL CUSTOM HOOK
import useCart from "hooks/useCart";
// GLOBAL CUSTOM COMPONENT
import IconComponent from "components/IconComponent";
// STYLED COMPONENTS
import { NavRow, SafeAreaInset, StyledNavLink, Wrapper } from "./styles";
// CUSTOM DATA MODEL
import { MobileNavItem } from "models/Layout.model";

const PROFILE_HREF = "/profile";

// ==============================================================
type Props = { navigation: MobileNavItem[] };
// ==============================================================

function NavItemIcon({
  icon,
  href,
  badge,
  cartCount
}: {
  icon: string;
  href: string;
  badge: boolean;
  cartCount: number;
}) {
  const { user, profile, loading } = useAuth();
  const isProfile = href === PROFILE_HREF;

  if (isProfile && !loading && user) {
    const displayName =
      profile?.full_name?.trim() || user.email?.split("@")[0] || "User";
    const avatarSrc =
      profile?.avatar_url ||
      user.user_metadata?.avatar_url ||
      "/assets/images/avatars/001-man.svg";

    return (
      <span className="icon">
        <Avatar alt={displayName} src={avatarSrc} sx={{ width: 24, height: 24 }} />
      </span>
    );
  }

  const navIcon = <IconComponent icon={icon} fontSize="small" className="icon" />;

  if (badge) {
    return (
      <Badge badgeContent={cartCount} color="primary">
        {navIcon}
      </Badge>
    );
  }

  return navIcon;
}

export function MobileNavigationBar({ navigation }: Props) {
  const { state } = useCart();
  const chromeVisible = useScrollChromeVisible();

  return (
    <Wrapper chromeHidden={!chromeVisible}>
      <NavRow>
        {navigation.map(({ icon, href, title, badge }) => (
          <StyledNavLink href={href} key={title}>
            <NavItemIcon icon={icon} href={href} badge={badge} cartCount={state.cart.length} />
            {title}
          </StyledNavLink>
        ))}
      </NavRow>
      <SafeAreaInset />
    </Wrapper>
  );
}
