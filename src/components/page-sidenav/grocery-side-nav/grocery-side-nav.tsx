// GLOBAL CUSTOM COMPONENTS
import { NavLink } from "components/nav-link";
// LOCAL CUSTOM COMPONENTS
import ListItem from "./components/list-item";
import NavAccordion from "./components/nav-accordion";
import OverlayScrollbar from "components/overlay-scrollbar";
// STYLED COMPONENTS
import { StyledCard } from "./styles";
// CUSTOM DATA MODEL
import { CategoryNavItem } from "models/CategoryNavList.model";

// ===========================================================
type Props = { navigation: CategoryNavItem[] };
// ===========================================================

export default function GrocerySideNav({ navigation }: Props) {
  return (
    <StyledCard elevation={1}>
      <OverlayScrollbar sx={{ maxHeight: "85dvh", padding: "20px 20px 14px 24px" }}>
        {navigation.map((item, ind) => {
          if (item.child) return <NavAccordion item={item} key={ind} />;

          return (
            <NavLink key={ind} href={item.href!} color="grey.700">
              <ListItem title={item.title} icon={item.icon} />
            </NavLink>
          );
        })}
      </OverlayScrollbar>
    </StyledCard>
  );
}
