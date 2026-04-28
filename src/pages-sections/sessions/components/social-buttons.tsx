import { Fragment } from "react";
// MUI
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import SvgIcon from "@mui/material/SvgIcon";

export default function SocialButtons() {
  return (
    <Fragment>
      <Box my={3}>
        <Divider>
          <Box lineHeight={1} px={1}>
            or
          </Box>
        </Divider>
      </Box>

      <Button
        fullWidth
        color="primary"
        variant="outlined"
        className="social-button"
        startIcon={
          <SvgIcon viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.326-.043-1.557-.14-2.857-.14C11.928 2 10 3.657 10 6.7v2.8H7v4h3V22h4z"
            />
          </SvgIcon>
        }
      >
        Continue with Facebook
      </Button>

      <Button
        fullWidth
        color="primary"
        variant="outlined"
        className="social-button"
        startIcon={
          <SvgIcon viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M3.064 7.51A10 10 0 0 1 12 2c2.695 0 4.959.991 6.69 2.605l-2.867 2.868C14.786 6.482 13.468 5.977 12 5.977c-2.605 0-4.81 1.76-5.595 4.123c-.2.6-.314 1.24-.314 1.9s.114 1.3.314 1.9c.786 2.364 2.99 4.123 5.595 4.123c1.345 0 2.49-.355 3.386-.955a4.6 4.6 0 0 0 1.996-3.018H12v-3.868h9.418c.118.654.182 1.336.182 2.045c0 3.046-1.09 5.61-2.982 7.35C16.964 21.105 14.7 22 12 22A9.996 9.996 0 0 1 2 12c0-1.614.386-3.14 1.064-4.49"
            />
          </SvgIcon>
        }
      >
        Continue with Google
      </Button>
    </Fragment>
  );
}
