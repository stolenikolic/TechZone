import type { ComponentProps } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Container from "@mui/material/Container";

// ==============================================================
interface Footer1Props extends ComponentProps<typeof Box> {}
// ==============================================================

export function Footer1({
  children,
  color = "white",
  bgcolor = "grey.900",
  mb = { lg: 0, xs: 8 },
  pt = { sm: 8, xs: 4 },
  ...props
}: Footer1Props) {
  return (
    <Box
      component="footer"
      overflow="hidden"
      bgcolor={bgcolor}
      color={color}
      mb={mb}
      pt={pt}
      {...props}
    >
      <Container>
        <Grid container spacing={3}>
          {children}
        </Grid>
      </Container>
    </Box>
  );
}

// ==================================================================
interface Footer1BrandProps extends ComponentProps<typeof Grid> {}
// ==================================================================

Footer1.Brand = function ({
  children,
  size = { lg: 4, sm: 6, xs: 12 },
  ...props
}: Footer1BrandProps) {
  return (
    <Grid size={size} {...props}>
      {children}
    </Grid>
  );
};

// ==================================================================
interface Footer1Widget1Props extends ComponentProps<typeof Grid> {}
// ==================================================================

Footer1.Widget1 = function ({
  children,
  size = { lg: 2, sm: 6, xs: 12 },
  ...props
}: Footer1Widget1Props) {
  return (
    <Grid size={size} {...props}>
      {children}
    </Grid>
  );
};

// ==================================================================
interface Footer1Widget2Props extends ComponentProps<typeof Grid> {}
// ==================================================================

Footer1.Widget2 = function ({
  children,
  size = { lg: 3, sm: 6, xs: 12 },
  ...props
}: Footer1Widget2Props) {
  return (
    <Grid size={size} {...props}>
      {children}
    </Grid>
  );
};

// ==================================================================
interface Footer1ContactProps extends ComponentProps<typeof Grid> {}
// ==================================================================

Footer1.Contact = function ({
  children,
  size = { lg: 3, sm: 6, xs: 12 },
  ...props
}: Footer1ContactProps) {
  return (
    <Grid size={size} {...props}>
      {children}
    </Grid>
  );
};

// ==================================================================
interface Footer1CopyrightProps extends ComponentProps<typeof Grid> {}
// ==================================================================

Footer1.Copyright = function ({ children, size = 12, ...props }: Footer1CopyrightProps) {
  return (
    <Grid size={size} {...props}>
      {children}
    </Grid>
  );
};
