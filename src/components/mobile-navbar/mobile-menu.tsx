"use client";

import { Fragment, useCallback, useState } from "react";
// MUI
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import Clear from "@mui/icons-material/Clear";
// GLOBAL CUSTOM COMPONENT
import OverlayScrollbar from "components/overlay-scrollbar";
// RENDER MENU LEVEL FUNCTION
import { renderLevels } from "./render-levels";
// NAVIGATION DATA LIST
import { updateNavigation } from "./modified-navigation";
// CUSTOM DATA MODEL
import { Menu } from "models/Navigation.model";

// ==============================================================
type Props = { navigation: Menu[] };
// ==============================================================

export function MobileMenu({ navigation }: Props) {
  const [openDrawer, setOpenDrawer] = useState(false);
  const handleClose = useCallback(() => setOpenDrawer(false), []);
  const handleOpen = useCallback(() => setOpenDrawer(true), []);

  return (
    <Fragment>
      <IconButton
        onClick={handleOpen}
        sx={{ flexShrink: 0, color: "grey.600" }}
        aria-label="Open menu"
        aria-expanded={openDrawer}
        aria-controls="mobile-menu-drawer"
      >
        <MenuIcon />
      </IconButton>

      <Drawer
        anchor="left"
        open={openDrawer}
        onClose={handleClose}
        sx={{ zIndex: 15001 }}
        id="mobile-menu-drawer"
        aria-label="Mobile navigation menu"
      >
        <Box width="100vw" height="100%" position="relative">
          <OverlayScrollbar sx={{ height: "100vh" }}>
            <Box px={5} py={8} maxWidth={500} margin="auto" position="relative" height="100%">
              <IconButton
                onClick={handleClose}
                sx={{ position: "absolute", right: 30, top: 15 }}
                aria-label="Close menu"
              >
                <Clear fontSize="small" />
              </IconButton>

              {renderLevels(updateNavigation(navigation), handleClose)}
            </Box>
          </OverlayScrollbar>
        </Box>
      </Drawer>
    </Fragment>
  );
}
