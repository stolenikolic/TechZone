import Box from "@mui/material/Box";
// LOCAL CUSTOM COMPONENTS
import LeftContent from "./left-content";
import RightContent from "./right-content";
// STYLED COMPONENTS
import { StyledToolBar, DashboardNavbarRoot } from "./styles";

export default function DashboardNavbar() {
  return (
    <DashboardNavbarRoot position="sticky">
      <Box sx={{ px: { xs: 2, md: 3 } }}>
        <StyledToolBar disableGutters>
          {/* BROWSE WEBSITE & TOGGLE BUTTON */}
          <LeftContent />

          <Box flexGrow={1} />

          {/* PROFILE & NOTIFICATION BUTTONS AREA */}
          <RightContent />
        </StyledToolBar>
      </Box>
    </DashboardNavbarRoot>
  );
}
