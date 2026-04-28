/**
 * One-off: extract attributes for a single SSD product with strict schema.
 * Run: npx tsx scripts/extract-ssd-attributes.ts
 * (Ensure OPENAI_API_KEY is in .env.local or env)
 */
import OpenAI from "openai";
import { config } from "dotenv";

config({ path: ".env.local" });
config(); // .env fallback

const productName = "ADATA 256GB Legend 710 M.2 PCIe M.2 2280 ALEG-710-256GCS";

const prompt = `Extract attributes for the following SSD product. Return JSON only. No markdown, no explanation.
If an attribute is unknown, use null.

Product name:
${productName}

Return a JSON object with exactly these keys. Use only the types and values specified:

- capacity (number, in GB)
- size (string, choose ONE only): "2.5" | "M.2 2230" | "M.2 2242" | "M.2 2260" | "M.2 2280" | "mSATA"
- connection (string, choose ONE only): "SATA" | "PCIe" | "NVMe" | "M.2 PCIe" | "M.2 SATA"
- pcie_generation (number or null, choose ONE only): 3 | 4 | 5
- heatsink (boolean)
- read_speed (number, MB/s)
- write_speed (number, MB/s)

From the product name: 256GB = capacity 256, M.2 2280 = size. Legend 710 is PCIe. Use null for unknown.`;

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.1
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("No content");
  const json = JSON.parse(content);
  console.log(JSON.stringify(json, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
