import OfferBanner from "./banner";
import ColumnList from "./column-list";
import CategoryMenuListItem from "../category-list-item";
// STYLED COMPONENT
import { StyledRoot } from "./styles";
// DATA TYPE
import { CategoryMenuItem } from "models/Category.model";

// =======================================================================
type Props = { data: CategoryMenuItem[] };
// =======================================================================

export default function MegaMenu2({ data }: Props) {
  return (
    <StyledRoot elevation={5}>
      {data.map((item) => (
        <CategoryMenuListItem
          href={item.href}
          icon={item.icon}
          key={item.title}
          title={item.title}
          caret={!!item.children}
          render={
            item.children?.length ? (
              <ColumnList minWidth={550} list={item.children}>
                <OfferBanner />
              </ColumnList>
            ) : null
          }
        />
      ))}
    </StyledRoot>
  );
}
