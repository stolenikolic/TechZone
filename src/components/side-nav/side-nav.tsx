import { useEffect, useState, ReactNode, useCallback } from "react";
import Drawer from "@mui/material/Drawer";
// GLOBAL CUSTOM COMPONENT
import OverlayScrollbar from "components/overlay-scrollbar";

// ================================================================
interface Props {
  open?: boolean;
  width?: number;
  children: ReactNode;
  toggle?: () => void;
  position?: "left" | "right";
  handler: (event: () => void) => ReactNode;
}
// ================================================================

export default function SideNav({
  position = "left",
  open = false,
  width = 280,
  children,
  handler,
  toggle
}: Props) {
  const [sideNavOpen, setSideNavOpen] = useState(open);

  useEffect(() => setSideNavOpen(open), [open]);

  const handleToggleSideNav = useCallback(() => {
    setSideNavOpen((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    if (toggle) {
      toggle();
    } else {
      handleToggleSideNav();
    }
  }, [toggle, handleToggleSideNav]);

  return (
    <div>
      <Drawer
        anchor={position}
        open={sideNavOpen}
        onClose={handleClose}
        sx={{ zIndex: 15001 }}
        slotProps={{
          transition: {
            style: {
              width
            }
          }
        }}
      >
        <OverlayScrollbar>{children}</OverlayScrollbar>
      </Drawer>

      {handler(handleClose)}
    </div>
  );
}
