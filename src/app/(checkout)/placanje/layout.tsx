import type { PropsWithChildren } from "react";
import Container from "@mui/material/Container";
import CheckoutFlowBreadcrumbs from "components/checkout-flow-breadcrumbs";
import Steppers from "../steppers";

export default function Layout({ children }: PropsWithChildren) {
  return (
    <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
      <CheckoutFlowBreadcrumbs />
      <Steppers />
      {children}
    </Container>
  );
}
