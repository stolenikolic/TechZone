import type { SupabaseClient } from "@supabase/supabase-js";
import { createAiProvider } from "lib/ai/AiProvider";
import {
  DESCRIPTION_ANGLES,
  MAX_SPECS_IN_PROMPT,
  MIN_SPECS_TO_GENERATE
} from "lib/ai-descriptions/constants";
import { computeInputHash, pickAngle } from "lib/ai-descriptions/hash";
import { validateAiDescriptionOutput } from "lib/ai-descriptions/qa";
import type { GenerateForProductResult, PromptSpecLine } from "lib/ai-descriptions/types";
import { DEFAULT_MODEL } from "lib/ai-descriptions/constants";

type CategoryAiConfig = {
  tone: string | null;
  audience: string | null;
  extra_instructions: string | null;
  is_enabled: boolean;
};

type AiAttributeRow = {
  attribute_id: string;
  ai_description_priority: number;
  attributes:
    | {
        slug: string;
        name: string;
        name_bs: string | null;
        filter_unit: string | null;
      }
    | {
        slug: string;
        name: string;
        name_bs: string | null;
        filter_unit: string | null;
      }[]
    | null;
};

function formatSpecValue(value: string, unit: string | null): string {
  const v = value.trim();
  if (!unit?.trim()) return v;
  const u = unit.trim();
  if (v.toLowerCase().includes(u.toLowerCase())) return v;
  return `${v} ${u}`;
}

async function loadAiSpecConfig(
  supabase: SupabaseClient,
  categoryId: string | null
): Promise<{ config: CategoryAiConfig | null; attributeRows: AiAttributeRow[] }> {
  if (!categoryId) return { config: null, attributeRows: [] };

  const [{ data: config }, { data: attrRows }] = await Promise.all([
    supabase
      .from("category_ai_description_config")
      .select("tone, audience, extra_instructions, is_enabled")
      .eq("category_id", categoryId)
      .maybeSingle(),
    supabase
      .from("category_attributes")
      .select(
        "attribute_id, ai_description_priority, attributes(slug, name, name_bs, filter_unit)"
      )
      .eq("category_id", categoryId)
      .eq("include_in_ai_description", true)
      .order("ai_description_priority", { ascending: true })
      .limit(MAX_SPECS_IN_PROMPT)
  ]);

  return {
    config: (config as CategoryAiConfig | null) ?? null,
    attributeRows: (attrRows ?? []) as AiAttributeRow[]
  };
}

async function loadProductAttributeValues(
  supabase: SupabaseClient,
  productId: string,
  attributeIds: string[]
): Promise<Map<string, string>> {
  if (attributeIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("product_attributes")
    .select("attribute_id, value")
    .eq("product_id", productId)
    .in("attribute_id", attributeIds);
  if (error) throw new Error(`loadProductAttributeValues: ${error.message}`);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.value != null && String(row.value).trim()) {
      map.set(row.attribute_id as string, String(row.value).trim());
    }
  }
  return map;
}

export type ProductForAiDescription = {
  id: string;
  name: string;
  brand: string | null;
  category_id: string | null;
  description: string | null;
  ai_description_input_hash: string | null;
  ai_description_locked: boolean;
  ai_description_status: string | null;
  categories?: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

export type GenerateOptions = {
  force?: boolean;
  autoApprove?: boolean;
};

/**
 * Generate (or skip) AI description for a single product.
 */
export async function generateDescriptionForProduct(
  supabase: SupabaseClient,
  product: ProductForAiDescription,
  options?: GenerateOptions
): Promise<GenerateForProductResult> {
  if (product.ai_description_locked && !options?.force) {
    return { ok: false, reason: "locked" };
  }

  const categoryId = product.category_id;
  const { config, attributeRows } = await loadAiSpecConfig(supabase, categoryId);

  if (config && config.is_enabled === false) {
    return { ok: false, reason: "disabled" };
  }

  const specLines: PromptSpecLine[] = [];
  const attributeIds: string[] = [];

  for (const row of attributeRows) {
    const attr = Array.isArray(row.attributes) ? row.attributes[0] : row.attributes;
    if (!attr) continue;
    attributeIds.push(row.attribute_id);
  }

  const valuesByAttrId = await loadProductAttributeValues(supabase, product.id, attributeIds);

  for (const row of attributeRows) {
    const attr = Array.isArray(row.attributes) ? row.attributes[0] : row.attributes;
    if (!attr) continue;
    const rawValue = valuesByAttrId.get(row.attribute_id);
    if (!rawValue) continue;
    const label = (attr.name_bs ?? attr.name).trim();
    specLines.push({
      label,
      value: formatSpecValue(rawValue, attr.filter_unit)
    });
  }

  if (specLines.length < MIN_SPECS_TO_GENERATE) {
    await supabase
      .from("products")
      .update({ ai_description_status: "weak", updated_at: new Date().toISOString() })
      .eq("id", product.id);
    return { ok: false, reason: "weak" };
  }

  const inputHash = computeInputHash(product.name, specLines);
  if (
    !options?.force &&
    product.ai_description_input_hash === inputHash &&
    product.description?.trim()
  ) {
    return { ok: false, reason: "unchanged" };
  }

  const categoryRaw = product.categories;
  const categoryName = Array.isArray(categoryRaw)
    ? categoryRaw[0]?.name ?? "Proizvod"
    : categoryRaw?.name ?? "Proizvod";

  const angle = pickAngle(product.id, DESCRIPTION_ANGLES);
  const extraParts = [config?.extra_instructions?.trim(), config?.tone ? `Ton: ${config.tone}` : null].filter(
    Boolean
  );

  const provider = createAiProvider();
  const output = await provider.generateDescription({
    productName: product.name,
    brand: product.brand,
    categoryName,
    audience: config?.audience ?? null,
    angle,
    specLines,
    extraInstructions: extraParts.length > 0 ? extraParts.join("\n") : null
  });

  const qa = validateAiDescriptionOutput(output, product.name, specLines);
  if (!qa.ok) {
    return { ok: false, reason: "qa_failed", message: qa.reasons.join("; ") };
  }

  const status = options?.autoApprove ? "approved" : "generated";

  const { error: updateError } = await supabase
    .from("products")
    .update({
      description: output.description_html,
      ai_meta_description: output.meta_description,
      ai_title_suggestion: output.title_suggestion,
      ai_og_description: output.og_description,
      ai_faq: output.faq,
      ai_description_status: status,
      ai_description_input_hash: inputHash,
      ai_description_model: DEFAULT_MODEL,
      ai_description_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", product.id);

  if (updateError) throw new Error(`update product: ${updateError.message}`);

  return { ok: true, output, inputHash, model: DEFAULT_MODEL };
}
