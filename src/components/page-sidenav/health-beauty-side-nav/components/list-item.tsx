"use client";

import { useParams } from "next/navigation";
import Typography from "@mui/material/Typography";
import clsx from "clsx";
// GLOBAL CUSTOM COMPONENTS
import IconComponent from "components/IconComponent";
// CUSTOM DATA MODEL
import { CategoryNavItem } from "models/CategoryNavList.model";

// ==============================================================
type Props = { item: CategoryNavItem };
// ==============================================================

export default function ListItem({ item }: Props) {
  const { title, href, icon } = item;

  const { category } = useParams();
  const active = href!.endsWith(category as string);

  return (
    <div className={clsx("list-item", { active })}>
      <IconComponent icon={icon} fontSize="small" color="inherit" />
      <Typography component="span" className="list-item-title">
        {title}
      </Typography>
    </div>
  );
}
