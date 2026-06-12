import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = ["p", "ul", "li", "strong", "h2", "h3"];

/** Sanitize AI-generated product description HTML for safe rendering on PDP. */
export function sanitizeProductHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: []
  });
}
