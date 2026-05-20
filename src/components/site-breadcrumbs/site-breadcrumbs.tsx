"use client";

import Link from "next/link";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

export type SiteBreadcrumbItem = {
  label: string;
  /** Omit for the current page (non-interactive). */
  href?: string;
};

export type SiteBreadcrumbsProps = {
  /** Segments after «Početna» — «Početna» is always prepended with href «/». */
  items: SiteBreadcrumbItem[];
  sx?: SxProps<Theme>;
};

const linkSx: SxProps<Theme> = {
  fontSize: "12px",
  color: "text.primary",
  textDecoration: "none",
  transition: "color 0.15s ease",
  "&:hover": { color: "primary.main" }
};
const currentSx = {
  color: "text.secondary",
  opacity: 0.72,
  fontWeight: 400,
  fontSize: "10px"
} as const;

/**
 * Jedinstveni izgled breadcrumbs-a (isti MUI obrazac kao na PDP-u).
 */
export default function SiteBreadcrumbs({ items, sx }: SiteBreadcrumbsProps) {
  if (!items.length) return null;

  return (
    <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2, ...sx }}>
      <Link href="/" style={{ textDecoration: "none" }}>
        <Typography variant="body2" component="span" sx={linkSx}>
          Početna
        </Typography>
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        if (item.href && !isLast) {
          return (
            <Link key={`${item.label}-${index}`} href={item.href} style={{ textDecoration: "none" }}>
              <Typography variant="body2" component="span" sx={linkSx}>
                {item.label}
              </Typography>
            </Link>
          );
        }
        return (
          <Typography key={`${item.label}-${index}`} variant="body2" component="span" sx={currentSx}>
            {item.label}
          </Typography>
        );
      })}
    </Breadcrumbs>
  );
}
