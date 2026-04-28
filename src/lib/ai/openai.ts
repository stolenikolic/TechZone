import OpenAI from "openai";

const MODEL = "gpt-4o-mini";

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey });
}

/**
 * Build the prompt for attribute extraction. When using web search, instructs the model
 * to research the product online and extract from trusted sources (manufacturer, reviews, stores).
 */
function buildPrompt(
  productName: string,
  description: string | null,
  attributes: string[]
): string {
  const desc = (description || "").trim().slice(0, 2000);
  const slugList = attributes.join("\n");

  return `You are a product data expert. Research the following product on the internet (manufacturer page, reviews, stores) and extract technical attributes. Return ONLY a valid JSON object, no markdown, no explanation, no citations in the JSON. Keys must be exactly the attribute slugs listed. Use appropriate types: numbers as numbers, booleans as true/false, strings for text. Use null only if the value cannot be determined from trusted sources.

Product name/model:
${productName}

Description (if any):
${desc || "(none)"}

Attributes to generate (return these keys only):
${slugList}

Example format:
{"capacity": 1000, "size": "M.2 2280", "connection": "PCIe", "pcie_generation": 4, "read_speed": 7450, "write_speed": 6900, "heatsink": false}

Return JSON only:`;
}

/**
 * Generate product attribute values using OpenAI Responses API with web_search enabled.
 * The model can search the internet for the product and extract attributes from
 * trusted sources (manufacturer, reviews, stores).
 *
 * @param productName - Product display name or model (e.g. "ADATA 256GB Legend 710 M.2 PCIe M.2 2280 ALEG-710-256GCS")
 * @param description - Product description (optional)
 * @param attributes - List of attribute slugs to generate (e.g. ["capacity", "size", "read_speed"])
 * @returns JSON object with attribute slugs as keys and generated values (number, string, or boolean)
 */
export async function generateAttributes(
  productName: string,
  description: string | null,
  attributes: string[]
): Promise<Record<string, unknown>> {
  if (attributes.length === 0) return {};

  const client = getClient();
  const prompt = buildPrompt(productName, description, attributes);

  // Web search cannot be combined with JSON mode; ask for JSON in prompt and parse output.
  const response = await client.responses.create({
    model: MODEL,
    input: prompt,
    tools: [{ type: "web_search" }],
    temperature: 0.2
  });

  const outputText = response.output_text?.trim() ?? "";
  if (!outputText) {
    throw new Error("OpenAI Responses API returned no output text");
  }

  let raw = outputText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const firstBrace = raw.indexOf("{");
  if (firstBrace !== -1) {
    const lastBrace = raw.lastIndexOf("}");
    if (lastBrace > firstBrace) raw = raw.slice(firstBrace, lastBrace + 1);
  }
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const slug of attributes) {
    const v = parsed[slug];
    if (v !== undefined && v !== null) {
      result[slug] = v;
    }
  }
  return result;
}
