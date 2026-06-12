"use client";

import Typography from "@mui/material/Typography";
import { styled } from "@mui/material/styles";
import { sanitizeProductHtml } from "lib/html/sanitize-product-html";

const DescriptionHtml = styled("div")(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: theme.typography.body1.fontSize,
  lineHeight: 1.7,
  "& p": {
    margin: "0 0 1em"
  },
  "& p:last-child": {
    marginBottom: 0
  },
  "& h2": {
    ...theme.typography.h3,
    margin: "1.5em 0 0.75em",
    "&:first-child": { marginTop: 0 }
  },
  "& h3": {
    ...theme.typography.h5,
    fontWeight: 600,
    margin: "1.25em 0 0.5em",
    "&:first-child": { marginTop: 0 }
  },
  "& strong": {
    fontWeight: 600
  },
  "& ul": {
    listStyle: "disc",
    margin: "0.5em 0 1em",
    paddingLeft: "1.25em"
  },
  "& li": {
    marginBottom: "0.35em"
  },
  "& li::marker": {
    color: theme.palette.text.secondary
  }
}));

// ================================================================
type Props = { description?: string | null };
// ================================================================

function looksLikeHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

export default function ProductDescription({ description }: Props) {
  const content = description?.trim();
  if (!content) {
    return (
      <Typography variant="body1" color="text.secondary">
        Opis proizvoda trenutno nije dostupan.
      </Typography>
    );
  }

  if (looksLikeHtml(content)) {
    const safe = sanitizeProductHtml(content);
    return <DescriptionHtml dangerouslySetInnerHTML={{ __html: safe }} />;
  }

  return (
    <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
      {content}
    </Typography>
  );
}
