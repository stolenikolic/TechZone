"use client";

import { Fragment, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
// MUI
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { styled } from "@mui/material/styles";

// STYLED COMPONENT
const StyledRoot = styled("div")(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: theme.spacing(4),
  [theme.breakpoints.down("sm")]: { display: "none" }
}));

const StyledChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== "active"
})<{ active: boolean }>(({ theme, active }) => ({
  fontSize: "14px",
  fontWeight: "500",
  marginBlock: "4px",
  padding: "0.5rem 1rem",
  color: theme.palette.primary.main,
  backgroundColor: theme.palette.primary.light,
  "&:hover:not(:disabled)": {
    color: theme.palette.primary.contrastText,
    backgroundColor: theme.palette.primary.main
  },
  ...(active && {
    color: theme.palette.primary.contrastText,
    backgroundColor: theme.palette.primary.main
  })
}));

const STEPPER_LIST = [
  { title: "Cart", disabled: false, path: "/cart" },
  { title: "Details", disabled: false, path: "/checkout" },
  { title: "Payment", disabled: false, path: "/payment" },
  { title: "Review", disabled: true, path: "/orders" }
];

const PATH_TO_STEP: Record<string, number> = {
  "/cart": 0,
  "/orders": 3,
  "/payment": 2,
  "/checkout": 1
};

export default function Steppers() {
  const router = useRouter();
  const pathname = usePathname();
  const currentStep = useMemo(() => PATH_TO_STEP[pathname] ?? 0, [pathname]);

  const handleStepChange = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router]
  );

  return (
    <StyledRoot>
      {STEPPER_LIST.map((step, ind) => (
        <Fragment key={step.title}>
          <StyledChip
            role="button"
            disabled={step.disabled}
            active={ind <= currentStep}
            label={`${ind + 1}. ${step.title}`}
            onClick={() => handleStepChange(step.path)}
            aria-current={ind === currentStep ? "step" : undefined}
            tabIndex={step.disabled ? -1 : 0}
          />

          {ind < STEPPER_LIST.length - 1 && (
            <Box
              width="50px"
              height="4px"
              bgcolor={ind < currentStep ? "primary.main" : "primary.light"}
              role="separator"
              aria-hidden="true"
            />
          )}
        </Fragment>
      ))}
    </StyledRoot>
  );
}
