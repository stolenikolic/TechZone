import Link from "next/link";
import Image from "next/image";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
// LOCAL CUSTOM COMPONENTS
import { FooterApps } from "./footer-apps";
import { FooterSocialLinks } from "./footer-social-links";
// STYLED COMPONENTS
import { StyledFooter, StyledLink } from "./styles";
// CUSTOM DATA
import { footerSocialLinks, footerCustomerCareLinks, footerDescription } from "data/layout-data";

export function Footer2() {
  return (
    <StyledFooter>
      <Grid container spacing={6}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Link href="/">
            <Image alt="logo" width={105} height={50} src="/assets/images/logo.svg" />
          </Link>

          <Typography variant="body1" sx={{ mt: 3, mb: 2.5, maxWidth: 370 }}>
            {footerDescription}
          </Typography>

          <FooterApps appleStoreUrl="#" playStoreUrl="#" />
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <div className="links">
            {footerCustomerCareLinks.map(({ title, url }) => (
              <StyledLink href={url} key={title}>
                {title}
              </StyledLink>
            ))}
          </div>

          <FooterSocialLinks links={footerSocialLinks} />
        </Grid>
      </Grid>
    </StyledFooter>
  );
}
