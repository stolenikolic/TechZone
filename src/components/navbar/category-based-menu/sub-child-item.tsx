import Link from "next/link";
import Image from "next/image";
import Avatar from "@mui/material/Avatar";
// ICON COMPONENTS
import Icons from "icons/duotone";
// DATA TYPES
import { CategoryMenuItemWithChild } from "models/Navigation.model";
// STYLED COMPONENTS
import { SubCategoryListItem } from "./styles";

export function SubChildItem({ item }: { item: CategoryMenuItemWithChild }) {
  const { title, url = "/", icon, img } = item;

  const Icon = icon ? Icons[icon as keyof typeof Icons] : null;

  return (
    <Link href={url}>
      <SubCategoryListItem>
        {img && (
          <Avatar className="sub-item-avatar">
            <Image alt={title} src={img} fill sizes="(max-width: 768px) 100vw, 100vw" />
          </Avatar>
        )}

        {Icon && <Icon sx={{ fontSize: 16 }} />}
        {title}
      </SubCategoryListItem>
    </Link>
  );
}
