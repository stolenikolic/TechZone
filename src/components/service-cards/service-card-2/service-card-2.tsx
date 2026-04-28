import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import FlexBox from "components/flex-box/flex-box";
import IconComponent from "components/IconComponent";

// ==============================================================
interface Props {
  icon: string;
  title: string;
  description: string;
}
// ==============================================================

export default function ServiceCard2({ icon, title, description }: Props) {
  return (
    <FlexBox gap={1} p="1rem">
      <IconComponent
        icon={icon}
        color="inherit"
        fontSize="inherit"
        sx={{ color: "grey.900", fontSize: "40px" }}
      />

      <div>
        <Typography variant="h3" sx={{ color: "grey.900", lineHeight: 1.3 }}>
          {title}
        </Typography>

        <Typography variant="body1" sx={{ color: "grey.600" }}>
          {description}
        </Typography>
      </div>
    </FlexBox>
  );
}
