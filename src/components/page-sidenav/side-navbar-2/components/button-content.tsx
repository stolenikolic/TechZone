import Box from "@mui/material/Box";
// STYLED COMPONENT
import { ListIconWrapper } from "../styles";
// CUSTOM ICON COMPONENTS
import Icons from "icons/grocery-4";

// ==============================================================
type Props = { name: string; icon?: string };
type Keys = keyof typeof Icons;
// ==============================================================

export default function ButtonContent({ icon, name }: Props) {
  let content = null;

  if (icon) {
    const Icon = Icons[icon as Keys];
    content = (
      <ListIconWrapper>
        <Icon />
      </ListIconWrapper>
    );
  } else {
    content = <Box marginRight="0.6rem" />;
  }

  return (
    <Box display="flex" alignItems="center">
      {content}
      {name}
    </Box>
  );
}
