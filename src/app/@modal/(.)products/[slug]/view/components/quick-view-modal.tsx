"use client";

import { usePathname, useRouter } from "next/navigation";
import { type PropsWithChildren } from "react";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import DialogContent from "@mui/material/DialogContent";
import Close from "@mui/icons-material/Close";

const dialogStyles = {
  zIndex: 1501,
  boxShadow: 5
};

const dialogContentStyles = {
  maxWidth: 500,
  width: "100%",
  padding: 0
};

const iconButtonStyles = {
  position: "absolute",
  top: 3,
  right: 3
};

export default function QuickViewModal({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();

  const handleClose = () => {
    router.back();
  };

  return (
    <Dialog
      maxWidth={false}
      open={pathname.includes("/view")}
      onClose={handleClose}
      sx={dialogStyles}
    >
      <DialogContent sx={dialogContentStyles}>
        {children}

        <IconButton onClick={handleClose} sx={iconButtonStyles}>
          <Close fontSize="small" color="secondary" />
        </IconButton>
      </DialogContent>
    </Dialog>
  );
}
