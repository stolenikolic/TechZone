import { Fragment, ReactNode, useCallback, useState, MouseEvent } from "react";
import Menu from "@mui/material/Menu";
import { SxProps, Theme } from "@mui/material/styles";

// ===============================================================
interface Props {
  open?: boolean;
  sx?: SxProps<Theme>;
  direction?: "left" | "right" | "center";
  options: (onClose: () => void) => ReactNode;
  handler: (onClick: (event: MouseEvent<HTMLElement>) => void) => ReactNode;
}
// ===============================================================

export default function BazaarMenu({ open, sx, handler, options, direction = "left" }: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleClick = useCallback((event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  return (
    <Fragment>
      {handler(handleClick)}

      <Menu
        sx={sx}
        elevation={1}
        anchorEl={anchorEl}
        onClose={handleClose}
        open={open !== undefined ? open : !!anchorEl}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: direction
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: direction
        }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              boxShadow: 5,
              minWidth: 180,
              borderRadius: 2
            }
          }
        }}
      >
        {options(handleClose)}
      </Menu>
    </Fragment>
  );
}
