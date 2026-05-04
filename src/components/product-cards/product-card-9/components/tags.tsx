import Typography from "@mui/material/Typography";
// STYLED COMPONENTS
import { TagRoot } from "../styles";

// ==============================================================
type Props = { tags: string[] };
// ==============================================================

export default function ProductTags({ tags }: Props) {
  return (
    <TagRoot aria-label="Product categories and brand">
      {tags.map((item, index) => (
        <Typography key={`${item}-${index}`} component="span" variant="caption" color="text.secondary">
          {index > 0 ? " · " : null}
          {item}
        </Typography>
      ))}
    </TagRoot>
  );
}
