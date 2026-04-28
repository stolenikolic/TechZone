/**
 * Run AI attribute generation for all motherboard products (socket, chipset, memory_type, memory_sockets, m2_connectors).
 * Uses OpenAI with web_search; batch size 5. Does not overwrite existing attributes.
 *
 * Run: npx tsx scripts/run-motherboard-attributes.ts
 * Requires: .env.local with OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

async function main() {
  const { runMotherboardAttributeGenerator } = await import(
    "../src/lib/ai/attribute-generator"
  );
  const result = await runMotherboardAttributeGenerator();
  if (result.errors.length > 0) {
    console.error("Errors:", result.errors);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
