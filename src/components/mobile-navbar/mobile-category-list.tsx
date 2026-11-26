"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import ExpandMore from "@mui/icons-material/ExpandMore";
import IconComponent from "components/IconComponent";
import { NavLink } from "components/nav-link";
import type { CategoryMenuItem } from "models/Category.model";

type Props = {
  categories: CategoryMenuItem[];
  onNavigate: () => void;
};

function CategoryBranch({
  item,
  depth,
  onNavigate
}: {
  item: CategoryMenuItem;
  depth: number;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const children = item.children ?? [];
  const hasChildren = children.length > 0;

  return (
    <Box>
      <Box display="flex" alignItems="center" sx={{ pl: depth * 1.5 }}>
        <NavLink
          href={item.href}
          onClick={onNavigate}
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 0"
          }}
        >
          {depth === 0 && item.icon ? (
            <IconComponent icon={item.icon} fontSize="small" color="inherit" />
          ) : null}
          <Box
            component="span"
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontWeight: depth === 0 ? 600 : 400
            }}
          >
            {item.title}
          </Box>
        </NavLink>

        {hasChildren ? (
          <IconButton
            size="small"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? `Sakrij ${item.title}` : `Prikaži ${item.title}`}
          >
            <ExpandMore
              fontSize="small"
              sx={{
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform 150ms ease"
              }}
            />
          </IconButton>
        ) : null}
      </Box>

      {hasChildren && open
        ? children.map((child) => (
            <CategoryBranch key={child.href} item={child} depth={depth + 1} onNavigate={onNavigate} />
          ))
        : null}
    </Box>
  );
}

export function MobileCategoryList({ categories, onNavigate }: Props) {
  return (
    <Box>
      {categories.map((item) => (
        <CategoryBranch key={item.href} item={item} depth={0} onNavigate={onNavigate} />
      ))}
    </Box>
  );
}
