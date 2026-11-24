"use client";

import { createContext, useContext, type PropsWithChildren } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import NavItem from "./nav-item";
import useWishlist from "hooks/useWishlist";
import { MainContainer } from "./styles";

const OrderCountContext = createContext(0);

export function OrderCountProvider({ count, children }: PropsWithChildren<{ count: number }>) {
  return <OrderCountContext.Provider value={count}>{children}</OrderCountContext.Provider>;
}

export function Navigation() {
  const { count, isHydrated } = useWishlist();
  const orderCount = useContext(OrderCountContext);

  const dashboardMenus = [
    {
      title: "Nalog",
      list: [
        { count: orderCount, icon: "Packages", href: "/narudzbe", title: "Narudžbe" },
        { count: isHydrated ? count : 0, icon: "HeartLine", href: "/lista-zelja", title: "Lista želja" },
        { icon: "User3", href: "/profil", title: "Podaci o profilu" }
      ]
    }
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
          Nazad u prodavnicu
        </Button>
      </Box>
    </MainContainer>
  );
}
