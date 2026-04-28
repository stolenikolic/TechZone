"use client";

import { Fragment } from "react";
import { format } from "date-fns/format";
// MUI
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Avatar from "@mui/material/Avatar";
import { styled } from "@mui/material/styles";
import Done from "@mui/icons-material/Done";
// CUSTOM ICON COMPONENTS
import Delivery from "icons/Delivery";
import PackageBox from "icons/PackageBox";
import TruckFilled from "icons/TruckFilled";
// GLOBAL CUSTOM COMPONENTS
import { FlexBetween, FlexBox } from "components/flex-box";
// CUSTOM DATA MODEL
import { OrderStatus } from "models/Order.model";

// STYLED COMPONENTS
const StyledFlexbox = styled(FlexBetween)(({ theme }) => ({
  flexWrap: "wrap",
  marginTop: "2rem",
  marginBottom: "2rem",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column"
  },
  "& .line": {
    height: 2,
    minWidth: 50,
    flex: "1 1 0",
    [theme.breakpoints.down("sm")]: {
      flex: "unset",
      height: 50,
      minWidth: 4
    }
  }
}));

const StyledAvatar = styled(Avatar)(({ theme }) => ({
  top: -5,
  right: -5,
  width: 20,
  height: 20,
  position: "absolute",
  color: theme.palette.primary.main,
  backgroundColor: theme.palette.primary.light,
  boxShadow: theme.shadows[1],
  "& svg": { fontSize: 16 }
}));

const StyledStatusAvatar = styled(Avatar)(({ theme }) => ({
  width: 64,
  height: 64,
  transition: "all 0.3s ease",
  "&.completed": {
    color: theme.palette.common.white,
    backgroundColor: theme.palette.primary.main
  },
  "&.pending": {
    color: theme.palette.primary.main,
    backgroundColor: theme.palette.grey[100]
  }
}));

const DeliveryDateBox = styled("div")(({ theme }) => ({
  textAlign: "center",
  padding: "0.5rem 1rem",
  transition: "all 0.3s ease",
  color: theme.palette.primary.main,
  borderRadius: Number(theme.shape.borderRadius) * 3,
  backgroundColor: theme.palette.primary.light
}));

// ==============================================================
interface Props {
  status: OrderStatus;
  deliveredAt: Date;
  isDelivered: boolean;
}
// ==============================================================

const STEP_ICONS = [PackageBox, TruckFilled, Delivery];
const ORDER_STATUS_LIST = ["Pending", "Processing", "Delivered"];

export default function OrderProgress({ status, deliveredAt, isDelivered }: Props) {
  const statusIndex = ORDER_STATUS_LIST.indexOf(status);

  return (
    <Card
      elevation={0}
      sx={{
        mb: 4,
        p: "2rem 1.5rem",
        border: "1px solid",
        borderColor: "grey.100"
      }}
    >
      <StyledFlexbox>
        {STEP_ICONS.map((Icon, ind) => (
          <Fragment key={`step-${ind}`}>
            <Box position="relative">
              <StyledStatusAvatar
                alt={`shipping-step-${ind + 1}`}
                className={ind <= statusIndex ? "completed" : "pending"}
              >
                <Icon color="inherit" fontSize="large" />
              </StyledStatusAvatar>

              {ind < statusIndex && (
                <StyledAvatar alt="completed-step">
                  <Done color="inherit" />
                </StyledAvatar>
              )}
            </Box>

            {ind < STEP_ICONS.length - 1 && (
              <Box className="line" bgcolor={ind < statusIndex ? "primary.main" : "grey.100"} />
            )}
          </Fragment>
        ))}
      </StyledFlexbox>

      <FlexBox justifyContent={{ xs: "center", sm: "flex-end" }}>
        <DeliveryDateBox>
          Estimated Delivery Date{" "}
          <b>{isDelivered ? format(new Date(deliveredAt), "dd MMM yyyy") : "N/A"}</b>
        </DeliveryDateBox>
      </FlexBox>
    </Card>
  );
}
