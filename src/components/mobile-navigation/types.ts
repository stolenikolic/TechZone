import { SvgIconComponent } from "@mui/icons-material";

export default interface Item {
  title: string;
  href: string;
  badge: boolean;
  Icon: SvgIconComponent;
}
