"use client";

import { useEffect, type PropsWithChildren } from "react";
import { usePathname, useRouter } from "next/navigation";
// MUI
import Dialog from "@mui/material/Dialog";
import { Theme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

export default function LoginModalPage({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("xs"));

  useEffect(() => {
    if (pathname !== "/login") {
      router.replace(pathname);
    }
  }, [pathname, router]);

  if (pathname !== "/login") return null;

  const handleClose = () => {
    router.back();
  };

  return (
    <Dialog open scroll="body" fullWidth={isMobile} onClose={handleClose} sx={{ zIndex: 9999 }}>
      {children}
    </Dialog>
  );
}
