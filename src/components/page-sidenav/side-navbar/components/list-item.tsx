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
  const { category } = useParams();

  return (
    <div className={clsx({ "list-item": true, active: item.href!.endsWith(category as string) })}>
      <IconComponent icon={item.icon} fontSize="small" color="inherit" />
      <Typography variant="body1" sx={{ fontWeight: 500 }}>
        {item.title}
      </Typography>
    </div>
  );
}
