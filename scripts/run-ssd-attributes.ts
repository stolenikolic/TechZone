/**
 * Run AI attribute generation for all SSD products missing category attributes.
 * Uses OpenAI with web_search; batch size 5. Does not overwrite existing attributes.
 *
 * Run: npx tsx scripts/run-ssd-attributes.ts
 * Requires: .env.local with OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

async function main() {
  const { runSSDAttributeGenerator } = await import(
    "../src/lib/ai/attribute-generator"
  );
  const result = await runSSDAttributeGenerator();
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
