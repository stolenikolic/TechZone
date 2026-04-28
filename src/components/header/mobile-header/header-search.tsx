"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, PropsWithChildren, useEffect, useRef, useState } from "react";
// MUI
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
// MUI ICON COMPONENT
import Clear from "@mui/icons-material/Clear";
import Search from "@mui/icons-material/Search";
// GLOBAL CUSTOM COMPONENTS
import FlexBetween from "components/flex-box/flex-between";

export function HeaderSearch({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = useRef(`${pathname}?${searchParams}`);
  const [open, setOpen] = useState(false);

  const handleClose = () => setOpen(false);

  useEffect(() => {
    const newUrl = `${pathname}?${searchParams}`;
    if (currentUrl.current !== newUrl) {
      currentUrl.current = newUrl;
      queueMicrotask(handleClose);
    }
  }, [pathname, searchParams]);

  return (
    <Fragment>
      <IconButton onClick={() => setOpen(true)}>
        <Search />
      </IconButton>

      <Drawer open={open} anchor="top" onClose={handleClose} sx={{ zIndex: 9999 }}>
        <Box width="auto" padding={2} height="100vh">
          <FlexBetween mb={1}>
            <Typography variant="h6" color="text.secondary">
              Search to Bazaar
            </Typography>

            <IconButton onClick={handleClose}>
              <Clear fontSize="small" />
            </IconButton>
          </FlexBetween>

          {children}
        </Box>
      </Drawer>
    </Fragment>
  );
}
