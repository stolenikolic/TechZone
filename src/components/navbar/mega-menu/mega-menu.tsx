import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import List from "@mui/material/List";
import Typography from "@mui/material/Typography";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
// GLOBAL CUSTOM COMPONENTS
import { NavLink } from "components/nav-link";
// GLOBAL CUSTOM HOOKS
import useOverflowDetect from "hooks/useOverflowDetect";
// STYLED COMPONENTS
import { MenuListItem, MenusContainer, Wrapper } from "./styles";
// DATA TYPES
import { MegaMenuItem } from "models/Navigation.model";

// ===============================================================
interface Props {
  title: string;
  menuList: MegaMenuItem[][];
}
// ===============================================================

const gridSize = (length: number) => {
  if (length === 1) return 12;
  if (length === 2) return 6;
  if (length === 3) return 4;
  return 3;
};

export default function MegaMenu({ title, menuList }: Props) {
  // get grid size the basis of menu list
  const grid = gridSize(menuList.length);
  const { elementRef, isLeftOverflowing, isRightOverflowing, checkOverflow } = useOverflowDetect();

  return (
    <Wrapper onMouseOver={checkOverflow}>
      <div className="menu-title">
        {title}
        <KeyboardArrowDown className="icon" />
      </div>

      <MenusContainer
        ref={elementRef}
        className="menu-list"
        left={isLeftOverflowing}
        right={isRightOverflowing}
      >
        <Card className="card" elevation={5}>
          <Grid container>
            {menuList.slice(0, 4).map((category, key) => (
              <Grid size={{ md: grid }} key={key} className="grid-item">
                {category.map((item, i) => (
                  <CategoryList category={item} key={item.title + i} />
                ))}
              </Grid>
            ))}
          </Grid>
        </Card>
      </MenusContainer>
    </Wrapper>
  );
}

function CategoryList({ category: { title, child } }: { category: MegaMenuItem }) {
  return (
    <List>
      <Typography variant="h6" sx={{ mb: 0.5, pl: 4 }}>
        {title}
      </Typography>

      {child.map((sub, i) => (
        <NavLink href={sub.url!} key={sub.title + i}>
          <MenuListItem>{sub.title}</MenuListItem>
        </NavLink>
      ))}
    </List>
  );
}
