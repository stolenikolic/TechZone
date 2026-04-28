import type { PropsWithChildren } from "react";
import Container from "@mui/material/Container";
import Steppers from "../steppers";

export default function Layout({ children }: PropsWithChildren) {
  return (
    <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
      <Steppers />
      {children}
    </Container>
  );
}
