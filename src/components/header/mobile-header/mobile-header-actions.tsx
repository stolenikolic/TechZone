import { SearchInput2 } from "components/search-box";
import { HeaderCart } from "../header-cart";
import { HeaderSearch } from "./header-search";

export function MobileHeaderActions() {
  return (
    <>
      <HeaderSearch>
        <SearchInput2 />
      </HeaderSearch>
      <HeaderCart />
    </>
  );
}
