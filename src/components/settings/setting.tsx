"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Close from "@mui/icons-material/Close";
import Settings from "@mui/icons-material/Settings";
import FlexBox from "../flex-box/flex-box";
import OverlayScrollbar from "../overlay-scrollbar";
import useSettings from "hooks/useSettings";
import { BodyWrapper, MainContainer, StyledIconButton } from "./styles";

export default function Setting() {
  const [showBody, setShowBody] = useState(false);
  const { updateSettings, settings } = useSettings();

  return (
    <ClickAwayListener onClickAway={() => setShowBody(false)}>
      <MainContainer>
        <Tooltip title="Layout" placement="left">
          <StyledIconButton onClick={() => setShowBody((state) => !state)}>
            {showBody ? <Close /> : <Settings className="settings-icon" />}
          </StyledIconButton>
        </Tooltip>

        <BodyWrapper showBody={showBody ? 1 : 0}>
          <OverlayScrollbar sx={{ maxHeight: showBody ? "calc(100vh - 200px)" : 0 }}>
            <FlexBox gap={2}>
              <Button
                fullWidth
                onClick={() => updateSettings({ direction: "rtl" })}
                color={settings.direction === "rtl" ? "primary" : "secondary"}
                variant={settings.direction === "rtl" ? "contained" : "outlined"}
              >
                RTL
              </Button>

              <Button
                fullWidth
                onClick={() => updateSettings({ direction: "ltr" })}
                color={settings.direction === "ltr" ? "primary" : "secondary"}
                variant={settings.direction === "ltr" ? "contained" : "outlined"}
              >
                LTR
              </Button>
            </FlexBox>

            <Divider sx={{ my: 3 }} />
          </OverlayScrollbar>
        </BodyWrapper>
      </MainContainer>
    </ClickAwayListener>
  );
}
