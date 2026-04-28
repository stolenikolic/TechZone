import Typography from "@mui/material/Typography";
import IconComponent from "components/IconComponent";
import { FlexRowCenter } from "components/flex-box";

// ==============================================================
interface Props {
  icon: string;
  title: string;
  description: string;
}
// ==============================================================

export default function ServiceCard1({ icon, title, description }: Props) {
  return (
    <FlexRowCenter gap={3}>
      <IconComponent icon={icon} fontSize="large" />

      <div>
        <Typography variant="h4" lineHeight={1.6}>
          {title}
        </Typography>

        <Typography variant="body1" color="text.secondary">
          {description}
        </Typography>
      </div>
    </FlexRowCenter>
  );
}
