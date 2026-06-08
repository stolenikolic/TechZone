"use client";

import { createContext, PropsWithChildren, useContext } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useScrollChromeState } from "hooks/useScrollChrome";

const ScrollChromeContext = createContext(true);

export function ScrollChromeProvider({ children }: PropsWithChildren) {
  const theme = useTheme();
  const isMobileLayout = useMediaQuery(theme.breakpoints.down("lg"), { noSsr: true });
  const scrollChromeVisible = useScrollChromeState(isMobileLayout);
  const chromeVisible = isMobileLayout ? scrollChromeVisible : true;

  return (
    <ScrollChromeContext.Provider value={chromeVisible}>{children}</ScrollChromeContext.Provider>
  );
}

export function useScrollChromeVisible() {
  return useContext(ScrollChromeContext);
}
