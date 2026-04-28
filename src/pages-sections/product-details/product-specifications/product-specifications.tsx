import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Box from "@mui/material/Box";

export type ProductSpecItem = { name: string; slug: string; value: string };

// ==============================================================
type Props = { specifications: ProductSpecItem[] };
// ==============================================================

/**
 * Renders a "Specifications" section only when specifications exist.
 * Do not render when specifications.length === 0.
 */
export default function ProductSpecifications({ specifications }: Props) {
  if (!specifications?.length) return null;

  return (
    <Box sx={{ mt: 4, mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        Specifications
      </Typography>
      <Table size="small" sx={{ maxWidth: 480 }}>
        <TableBody>
          {specifications.map((spec) => (
            <TableRow key={spec.slug}>
              <TableCell component="th" scope="row" sx={{ fontWeight: 500, borderBottom: 1, borderColor: "divider" }}>
                {spec.name}
              </TableCell>
              <TableCell align="right" sx={{ borderBottom: 1, borderColor: "divider" }}>
                {spec.value}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
