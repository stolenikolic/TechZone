"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import NavItem from "./nav-item";
import useWishlist from "hooks/useWishlist";
import { MainContainer } from "./styles";

const ACCOUNT_MENUS = [
  {
    title: "ACCOUNT SETTINGS",
    list: [
      { icon: "User3", href: "/profile", title: "Profile Info" },
      { count: 16, icon: "Location", href: "/address", title: "Addresses" },
      { count: 4, icon: "CreditCard", href: "/payment-methods", title: "Payment Methods" }
    ]
  }
];

export function Navigation() {
  const { count, isHydrated } = useWishlist();

  const dashboardMenus = [
    {
      title: "DASHBOARD",
      list: [
        { count: 5, icon: "Packages", href: "/orders", title: "Orders" },
        { count: isHydrated ? count : 0, icon: "HeartLine", href: "/wish-list", title: "Lista želja" },
        { count: 1, icon: "Headset", href: "/support-tickets", title: "Support Tickets" }
      ]
    },
    ...ACCOUNT_MENUS
  ];

  return (
    <MainContainer>
      {dashboardMenus.map((item) => (
        <Box mt={2} key={item.title}>
          <Typography
            fontSize={12}
            variant="body1"
            fontWeight={500}
            color="text.secondary"
            textTransform="uppercase"
            sx={{ padding: ".75rem 1.75rem" }}
          >
            {item.title}
          </Typography>

          {item.list.map((listItem) => (
            <NavItem item={listItem} key={listItem.title} />
          ))}
        </Box>
      ))}

      <Box px={4} mt={6} pb={2}>
        <Button fullWidth color="primary" variant="contained" href="/">
          Back to Shop
        </Button>
      </Box>
    </MainContainer>
  );
}
