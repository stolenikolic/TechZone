"use client";

import { Fragment } from "react";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Link from "next/link";

export default function AuthConfirmPageView() {
  return (
    <Fragment>
      <Typography variant="h3" fontWeight={700} sx={{ mb: 2, textAlign: "center" }}>
        Provjerite email
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4, textAlign: "center" }}>
        Poslali smo vam link za potvrdu registracije. Nakon potvrde možete se prijaviti.
      </Typography>
      <Button component={Link} href="/login" fullWidth size="large" variant="contained" color="primary">
        Idi na prijavu
      </Button>
    </Fragment>
  );
}
