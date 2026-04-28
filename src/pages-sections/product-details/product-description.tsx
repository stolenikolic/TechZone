import Typography from "@mui/material/Typography";

// ================================================================
type Props = { description?: string | null };
// ================================================================

export default function ProductDescription({ description }: Props) {
  const content = description?.trim() || "No description available.";

  return (
    <div>
      <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
        {content}
      </Typography>
    </div>
  );
}
