import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
// CUSTOM COMPONENT
import { SubChildItem } from "./sub-child-item";
import OverlayScrollbar from "components/overlay-scrollbar";
// DATA TYPES
import { CategoryMenuItem } from "models/Navigation.model";
// STYLED COMPONENTS
import { SubCategoryList } from "./styles";

export function SubChildList({ subChildren }: { subChildren: CategoryMenuItem }) {
  return (
    <OverlayScrollbar sx={{ width: "100%" }}>
      <Box px={6} py={2} height="100%">
        {subChildren.child.map((item, key) => (
          <div key={key}>
            {/* NAV / CATEGORY TITLE */}
            <Typography variant="h6" sx={{ my: 3 }}>
              {item.title}
            </Typography>

            {/* NAV LIST ITEM / CATEGORY LIST ITEM */}
            <SubCategoryList>
              {item.child!.map((sub, key) => (
                <SubChildItem item={sub} key={key} />
              ))}
            </SubCategoryList>
          </div>
        ))}
      </Box>
    </OverlayScrollbar>
  );
}
