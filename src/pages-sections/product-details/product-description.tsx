"use client";

import Typography from "@mui/material/Typography";
import { styled } from "@mui/material/styles";
import { sanitizeProductHtml } from "lib/html/sanitize-product-html";

const DescriptionHtml = styled("div")(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: theme.typography.body1.fontSize,
  lineHeight: 1.7,
  "& p": {
    margin: "0 0 1.5em"
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
    fontWeight: 600,
    color: theme.palette.primary.main
  },
  "& ul": {
    listStyle: "none",
    margin: "0.75em 0 1.5em",
    padding: 0
  },
  "& li": {
    position: "relative",
    paddingLeft: "1.125rem",
    marginBottom: "0.625em",
    "&:last-child": {
      marginBottom: 0
    },
    "&::before": {
      content: '""',
      position: "absolute",
      left: 0,
      top: "0.72em",
      width: 6,
      height: 6,
      backgroundColor: theme.palette.primary.main,
      borderRadius: 1
    }
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
