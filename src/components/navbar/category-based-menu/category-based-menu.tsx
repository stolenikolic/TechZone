import { useState } from "react";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
// CUSTOM COMPONENTS
import { SubChildList } from "./sub-child-list";
// ICON COMPONENTS
import ChevronRight from "icons/ChevronRight";
// DATA TYPES
import { CategoryMenuItem } from "models/Navigation.model";
// STYLED COMPONENTS
import { Wrapper, StyledCard, CategoryList, MenusContainer, CategoryListItem } from "./styles";

// ===============================================================
interface Props {
  title: string;
  menuList: CategoryMenuItem[];
}
// ===============================================================

export function CategoryBasedMenu({ title, menuList }: Props) {
  const [selected, setSelected] = useState(menuList[0].title);

  const list = menuList.reduce<string[]>((prev, curr) => [...prev, curr.title], []);
  const childList = menuList.find((item) => item.title === selected);

  return (
    <Wrapper>
      <div className="menu-title">
        {title} <KeyboardArrowDown className="icon" />
      </div>

      <MenusContainer className="menu-list">
        <StyledCard>
          {/* MAIN CATEGORIES SECTION */}
          <CategoryList>
            {list.map((name) => (
              <CategoryListItem
                key={name}
                active={selected === name}
                onMouseEnter={() => setSelected(name)}
              >
                <span>{name}</span>
                <ChevronRight fontSize="small" className="icon" />
              </CategoryListItem>
            ))}
          </CategoryList>

          {/* SUB / CHILD CATEGORIES SECTION */}
          <SubChildList subChildren={childList!} />
        </StyledCard>
      </MenusContainer>
    </Wrapper>
  );
}
