import Link from "next/link";
import Typography from "@mui/material/Typography";
// LOCAL CUSTOM COMPONENT
import ListItem from "./components/list-item";
import NavAccordion from "./components/nav-accordion";
// STYLED COMPONENT
import { NavbarRoot } from "./styles";
// CUSTOM DATA MODEL
import { CategoryNavItem } from "models/CategoryNavList.model";

// =================================================================
type Props = { navigation: CategoryNavItem[] };
// =================================================================

export default function HealthBeautySideNav({ navigation }: Props) {
  return (
    <NavbarRoot>
      <div className="title">
        <Typography variant="h4">Categories</Typography>
      </div>

      {navigation.map((item, ind) => {
        if (item.child) {
          return <NavAccordion item={item} key={ind} />;
        }

        return (
          <Link key={ind} href={item.href!}>
            <ListItem item={item} />
          </Link>
        );
      })}
    </NavbarRoot>
  );
}
