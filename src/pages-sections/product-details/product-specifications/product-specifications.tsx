import Link from "next/link";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Box from "@mui/material/Box";
import {
  buildCategorySpecFilterHref,
  type ProductSpecFilterItem
} from "lib/shop/category-filter-url";

export type ProductSpecItem = ProductSpecFilterItem;

// ==============================================================
type Props = {
  specifications: ProductSpecItem[];
  categoryHref: string | null;
  /** When false, omit the section heading (parent/tab provides it). */
  showTitle?: boolean;
};
// ==============================================================

const linkSx = {
  color: "inherit",
  textDecoration: "none",
  borderBottom: "1px dotted",
  borderColor: "text.disabled",
  pb: "1px",
  transition: "color 0.2s ease, border-color 0.2s ease, border-bottom-style 0.15s ease",
  "&:hover": {
    color: "primary.main",
    borderColor: "primary.main",
    borderBottomStyle: "solid"
  }
} as const;

/**
 * Renders a "Specifications" section only when specifications exist.
 * Do not render when specifications.length === 0.
 */
export default function ProductSpecifications({
  specifications,
  categoryHref,
  showTitle = true
}: Props) {
  if (!specifications?.length) return null;

  return (
    <Box>
      {showTitle ? (
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          Specifikacije
        </Typography>
      ) : null}
      <Table size="small" sx={{ maxWidth: 480 }}>
        <TableBody>
          {specifications.map((spec) => {
            const href = buildCategorySpecFilterHref(categoryHref, spec);

            return (
              <TableRow key={`${spec.slug}-${spec.name}`}>
                <TableCell
                  component="th"
                  scope="row"
                  sx={{ fontWeight: 500, borderBottom: 1, borderColor: "divider" }}
                >
                  {spec.name}
                </TableCell>
                <TableCell align="right" sx={{ borderBottom: 1, borderColor: "divider" }}>
                  {href ? (
                    <Link href={href} style={{ color: "inherit", textDecoration: "none" }}>
                      <Typography component="span" variant="body2" sx={linkSx}>
                        {spec.value}
                      </Typography>
                    </Link>
                  ) : (
                    spec.value
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}
