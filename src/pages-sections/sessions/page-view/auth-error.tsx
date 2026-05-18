"use client";

import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Link from "next/link";

type Props = { message: string };

export default function AuthErrorPageView({ message }: Props) {
  return (
    <>
      <Typography variant="h3" fontWeight={700} sx={{ mb: 2, textAlign: "center" }}>
        Greška
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4, textAlign: "center" }}>
        {message}
      </Typography>
      <Button component={Link} href="/login" fullWidth size="large" variant="contained" color="primary">
        Nazad na prijavu
      </Button>
    </>
  );
}
