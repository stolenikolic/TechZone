"use client";

import type { PropsWithChildren } from "react";
import Button from "@mui/material/Button";
// MUI ICON COMPONENT
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
// CUSTOM ICON COMPONENTS
import Category from "icons/Category";
// GLOBAL CUSTOM COMPONENTS
import FlexBox from "components/flex-box/flex-box";
import { CategoryMenu } from "components/categories";

export function HeaderCategoryDropdown({ children }: PropsWithChildren) {
  return (
    <CategoryMenu
      render={(handler) => (
        <FlexBox color="grey.400" alignItems="center" marginInlineStart={2}>
          <Button onClick={handler}>
            <Category fontSize="small" color="inherit" />
            <KeyboardArrowDown fontSize="small" color="inherit" />
          </Button>
        </FlexBox>
      )}
    >
      {children}
    </CategoryMenu>
  );
}
