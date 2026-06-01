"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Menu from "@mui/material/Menu";
import Avatar from "@mui/material/Avatar";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import SvgIcon from "@mui/material/SvgIcon";
import { styled } from "@mui/material/styles";
import { useAuth } from "contexts/AuthContext";

const Divider = styled("div")(({ theme }) => ({
  margin: "0.5rem 0",
  border: `1px dashed ${theme.palette.grey[200]}`
}));

const menuPaperSx = {
  mt: 1,
  boxShadow: 2,
  minWidth: 200,
  borderRadius: "8px",
  overflow: "visible" as const,
  border: "1px solid",
  borderColor: "grey.200",
  "& .MuiMenuItem-root:hover": {
    backgroundColor: "grey.200"
  },
  "&:before": {
    top: 0,
    right: 14,
    zIndex: 0,
    width: 10,
    height: 10,
    content: '""',
    display: "block",
    position: "absolute",
    borderTop: "1px solid",
    borderLeft: "1px solid",
    borderColor: "grey.200",
    bgcolor: "background.paper",
    transform: "translateY(-50%) rotate(45deg)"
  }
};

export function HeaderLogin() {
  const router = useRouter();
  const { user, profile, loading, isAdmin, signOut } = useAuth();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);

  const handleClose = () => setAnchorEl(null);

  if (loading) {
    return (
      <IconButton disabled aria-label="Loading">
        <SvgIcon fontSize="small">
          <svg viewBox="0 0 24 24">
            <g fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="9" r="3" />
              <circle cx="12" cy="12" r="10" />
              <path
                strokeLinecap="round"
                d="M17.97 20c-.16-2.892-1.045-5-5.97-5s-5.81 2.108-5.97 5"
              />
            </g>
          </svg>
        </SvgIcon>
      </IconButton>
    );
  }

  if (!user) {
    return (
      <Link href="/login">
        <IconButton aria-label="Login">
          <SvgIcon fontSize="small">
            <svg viewBox="0 0 24 24">
              <g fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="9" r="3" />
                <circle cx="12" cy="12" r="10" />
                <path
                  strokeLinecap="round"
                  d="M17.97 20c-.16-2.892-1.045-5-5.97-5s-5.81 2.108-5.97 5"
                />
              </g>
            </svg>
          </SvgIcon>
        </IconButton>
      </Link>
    );
  }

  const displayName =
    profile?.full_name?.trim() || user.email?.split("@")[0] || "User";
  const avatarSrc = profile?.avatar_url || user.user_metadata?.avatar_url || "/assets/images/avatars/001-man.svg";
  const roleLabel = isAdmin ? "Admin" : "Customer";

  const handleSignOut = async () => {
    handleClose();
    await signOut();
    router.replace("/");
  };

  return (
    <div>
      <IconButton
        sx={{ padding: 0 }}
        aria-haspopup="true"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-expanded={open ? "true" : undefined}
        aria-controls={open ? "account-menu" : undefined}
      >
        <Avatar alt={displayName} src={avatarSrc} sx={{ width: 32, height: 32 }} />
      </IconButton>

      <Menu
        open={open}
        id="account-menu"
        anchorEl={anchorEl}
        onClose={handleClose}
        onClick={handleClose}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        slotProps={{ paper: { elevation: 0, sx: menuPaperSx } }}
      >
        <Box px={2} pt={1}>
          <Typography variant="h6">{displayName}</Typography>
          <Typography variant="body1" sx={{ fontSize: 12, color: "grey.500" }}>
            {roleLabel}
          </Typography>
        </Box>

        <Divider />
        <MenuItem component={Link} href="/profile">
          Profile
        </MenuItem>
        <MenuItem component={Link} href="/orders">
          My Orders
        </MenuItem>
        {isAdmin && (
          <MenuItem component={Link} href="/admin/products">
            Dashboard
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={handleSignOut}>Logout</MenuItem>
      </Menu>
    </div>
  );
}
