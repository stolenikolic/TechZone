export type AiFaqItem = {
  q: string;
  a: string;
};

export type AiDescriptionOutput = {
  description_html: string;
  meta_description: string;
  title_suggestion: string;
  og_description: string;
  faq: AiFaqItem[];
};

export type PromptSpecLine = {
  label: string;
  value: string;
};

export type BuildPromptInput = {
  productName: string;
  brand: string | null;
  categoryName: string;
  audience: string | null;
  angle: string;
  specLines: PromptSpecLine[];
  extraInstructions: string | null;
};

export type AiDescriptionsResult = {
  success: boolean;
  productsProcessed: number;
  descriptionsWritten: number;
  skippedWeak: number;
  skippedUnchanged: number;
  skippedLocked: number;
  qaFailed: number;
  errors: number;
  errorSamples?: Array<{ productId: string; message: string }>;
  errorDigest?: string;
};

export type GenerateForProductResult =
  | { ok: true; output: AiDescriptionOutput; inputHash: string; model: string }
  | { ok: false; reason: "weak" | "locked" | "unchanged" | "disabled" | "qa_failed" | "error"; message?: string };
