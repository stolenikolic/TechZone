"use client";

import { usePathname } from "next/navigation";
import Typography from "@mui/material/Typography";
// CUSTOM ICON COMPONENTS
import User3 from "icons/User3";
import Headset from "icons/Headset";
import Packages from "icons/Packages";
import Location from "icons/Location";
import HeartLine from "icons/HeartLine";
import CreditCard from "icons/CreditCard";
// STYLED COMPONENTS
import { StyledLink } from "./styles";

const icons = {
  Packages,
  HeartLine,
  Headset,
  User3,
  Location,
  CreditCard
};

// ==============================================================
interface Item {
  icon: string;
  href: string;
  title: string;
  count?: number;
}
// ==============================================================

export default function NavItem({ item }: { item: Item }) {
  const { href, icon, title, count } = item;

  const pathname = usePathname();
  const Icon = icons[icon as keyof typeof icons];

  return (
    <StyledLink href={href} key={title} isActive={pathname === href}>
      <div className="title">
        <Icon color="inherit" fontSize="small" className="nav-icon" />
        <Typography variant="body2">{title}</Typography>
      </div>

      {count ? <span>{count}</span> : null}
    </StyledLink>
  );
}
