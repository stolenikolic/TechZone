"use client";

import { Fragment, useCallback, useState } from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import MenuIcon from "@mui/icons-material/Menu";
import Clear from "@mui/icons-material/Clear";
import OverlayScrollbar from "components/overlay-scrollbar";
import { NavLink } from "components/nav-link";
import { renderLevels } from "./render-levels";
import { updateNavigation } from "./modified-navigation";
import { MobileCategoryList } from "./mobile-category-list";
import { MobileMenuAccount } from "./mobile-menu-account";
import { Menu } from "models/Navigation.model";
import type { CategoryMenuItem } from "models/Category.model";

const HIDDEN_WHEN_CATEGORIES = new Set([
  "/kategorije",
  "/kategorije/laptopi-racunari",
  "/kategorije/racunarske-komponente"
]);

type Props = {
  navigation: Menu[];
  categories?: CategoryMenuItem[];
};

export function MobileMenu({ navigation, categories = [] }: Props) {
  const [openDrawer, setOpenDrawer] = useState(false);
  const handleClose = useCallback(() => setOpenDrawer(false), []);
  const handleOpen = useCallback(() => setOpenDrawer(true), []);
  const hasCategories = categories.length > 0;
  const pageLinks = updateNavigation(navigation).filter((item) => {
    if (!item.url) return false;
    if (hasCategories && HIDDEN_WHEN_CATEGORIES.has(item.url)) return false;
    return true;
  });

  return (
    <Fragment>
      <IconButton
        onClick={handleOpen}
        sx={{ flexShrink: 0, color: "grey.600" }}
        aria-label="Otvori meni"
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
        <Box width="min(100vw, 420px)" height="100%" display="flex" flexDirection="column">
          <Box display="flex" alignItems="center" gap={1} pl={2} pr={1} py={1.5}>
            <Box flex={1} minWidth={0}>
              <MobileMenuAccount onNavigate={handleClose} />
            </Box>
            <IconButton onClick={handleClose} aria-label="Zatvori meni">
              <Clear fontSize="small" />
            </IconButton>
          </Box>

          <Divider />

          <OverlayScrollbar sx={{ flex: 1, minHeight: 0 }}>
            <Box px={2} py={1.5}>
              {hasCategories ? (
                <Box mb={1}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    fontWeight={600}
                    sx={{ py: 1, letterSpacing: 0.4, textTransform: "uppercase" }}
                  >
                    Kategorije
                  </Typography>
                  <MobileCategoryList categories={categories} onNavigate={handleClose} />
                  <Box py={1}>
                    <NavLink href="/kategorije" onClick={handleClose}>
                      Sve kategorije
                    </NavLink>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                </Box>
              ) : null}

              {renderLevels(pageLinks, handleClose)}
            </Box>
          </OverlayScrollbar>
        </Box>
      </Drawer>
    </Fragment>
  );
}
