"use client";

import Link from "next/link";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import { useAuth } from "contexts/AuthContext";

type Props = { onNavigate: () => void };

export function MobileMenuAccount({ onNavigate }: Props) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap={1.5} minHeight={48}>
        <Skeleton variant="circular" width={40} height={40} />
        <Skeleton variant="text" width={140} />
      </Box>
    );
  }

  if (!user) {
    return (
      <Button component={Link} href="/prijava" onClick={onNavigate} variant="contained" fullWidth>
        Prijavi se
      </Button>
    );
  }

  const displayName = profile?.full_name?.trim() || user.email?.split("@")[0] || "Korisnik";
  const avatarSrc =
    profile?.avatar_url || user.user_metadata?.avatar_url || "/assets/images/avatars/001-man.svg";

  return (
    <Box
      component={Link}
      href="/profil"
      onClick={onNavigate}
      aria-label={`Profil, ${displayName}`}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        minWidth: 0,
        color: "inherit",
        textDecoration: "none"
      }}
    >
      <Avatar alt={displayName} src={avatarSrc} sx={{ width: 40, height: 40, flexShrink: 0 }} />
      <Box minWidth={0}>
        <Typography noWrap fontWeight={600} lineHeight={1.3}>
          {displayName}
        </Typography>
        <Typography variant="body2" color="text.secondary" lineHeight={1.3}>
          Moj profil
        </Typography>
      </Box>
    </Box>
  );
}
