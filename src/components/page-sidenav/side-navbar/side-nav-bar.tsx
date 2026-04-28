import Link from "next/link";
// MUI
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";
// LOCAL CUSTOM COMPONENTS
import ListItem from "./components/list-item";
import Accordion from "./components/nav-accordion";
// STYLED COMPONENTS
import { BorderBox, ColorBorder, NavbarRoot } from "./styles";
// CUSTOM DATA MODEL
import CategoryNavList from "models/CategoryNavList.model";

// ==================================================================
interface Props {
  navList: CategoryNavList[];
  sx?: SxProps<Theme>;
  line?: "dash" | "solid";
  variant?: "transparent" | "colored";
}

// ==================================================================

export default function SideNavbar({
  sx,
  navList,
  line = "solid",
  variant = "transparent"
}: Props) {
  return (
    <NavbarRoot sidebar={variant} sx={sx}>
      {navList.map(({ category, categoryItem }, ind) => (
        <div key={ind + category}>
          {/* GROUP TITLE */}
          <Box padding="16px 20px 5px 20px">
            <Typography variant="h5">{category}</Typography>

            <BorderBox line={line}>
              <ColorBorder />
              <ColorBorder grey={1} />
            </BorderBox>
          </Box>

          {/* CATEGORY/NAV LIST */}
          {categoryItem.map((item, ind) => {
            if (item.child) return <Accordion item={item} key={ind} />;

            return (
              <Link key={item.title} href={item.href!}>
                <div className="linkList">
                  <ListItem item={item} />
                </div>
              </Link>
            );
          })}
        </div>
      ))}
    </NavbarRoot>
  );
}
