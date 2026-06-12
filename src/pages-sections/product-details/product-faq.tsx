import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";

type FaqItem = { q: string; a: string };

type Props = {
  items?: FaqItem[];
  /** When false, omit the section heading (tab label is enough). */
  showTitle?: boolean;
};

export default function ProductFaq({ items, showTitle = true }: Props) {
  if (!items?.length) return null;

  return (
    <Box>
      {showTitle ? (
        <Typography variant="h6" component="h2" sx={{ mb: 2, fontWeight: 600 }}>
          Često postavljana pitanja
        </Typography>
      ) : null}
      {items.map((item, index) => (
        <Box key={item.q}>
          {index > 0 ? <Divider sx={{ my: 2 }} /> : null}
          <Typography variant="subtitle1" component="h3" fontWeight={600}>
            {item.q}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            {item.a}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
