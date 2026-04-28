"use client";

import { styled } from "@mui/material/styles";
// LOCAL CUSTOM COMPONENTS
import MegaMenu1 from "./components/mega-menu/mega-menu-1";
import MegaMenu2 from "./components/mega-menu/mega-menu-2";
import CategoryListItem from "./components/category-list-item";
// CUSTOM DATA MODEL
import { CategoryMenuItem } from "models/Category.model";

// STYLED COMPONENT
export const StyledRoot = styled("div", {
  shouldForwardProp: (prop) => prop !== "position"
})<Position>(({ theme, position }) => ({
  left: 0,
  zIndex: 98,
  right: "auto",
  borderRadius: 8,
  padding: "0.5rem 0px",
  transformOrigin: "top",
  boxShadow: theme.shadows[5],
  position: position || "unset",
  backgroundColor: theme.palette.background.paper,
  top: position === "absolute" ? "calc(100% + 0.7rem)" : "0.5rem"
}));

// ==============================================================
interface Position {
  position?: "absolute" | "relative";
}

interface Props extends Position {
  categories: CategoryMenuItem[];
}
// ==============================================================

export function CategoryList({ categories, position = "absolute" }: Props) {
  return (
    <StyledRoot position={position}>
      {categories.map((item) => {
        const MegaMenu = item.component === "Grid" ? MegaMenu1 : MegaMenu2;

        return (
          <CategoryListItem
            key={item.title}
            href={item.href}
            icon={item.icon}
            title={item.title}
            caret={!!item.children}
            render={item.component ? <MegaMenu data={item.children!} banner={item.offer} /> : null}
          />
        );
      })}
    </StyledRoot>
  );
}
