/**
 * Script: Extract hard disk specifications from product names and insert into product_attributes.
 *
 * Category: Hard Disks (ID below). Attributes: capacity, rpm, buffer, size_inch.
 * Run: npx tsx scripts/extract-hard-disk-specs.ts
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const HARD_DISK_CATEGORY_ID = "0611a4e7-9f63-4321-b474-743f55e61c6e";

const REGEX = {
  capacity: /(\d+)\s?TB/i,
  rpm: /(\d{4,5})\s?rpm/i,
  buffer: /(\d+)\s?MB/i,
  size_inch: /(2\.5|3\.5)"/i
} as const;

type AttributeSlug = keyof typeof REGEX;

function extractSpecs(name: string): Partial<Record<AttributeSlug, string>> {
  const out: Partial<Record<AttributeSlug, string>> = {};
  const cap = name.match(REGEX.capacity);
  if (cap) out.capacity = `${cap[1]}TB`;
  const rpmMatch = name.match(REGEX.rpm);
  if (rpmMatch) out.rpm = rpmMatch[1];
  const buf = name.match(REGEX.buffer);
  if (buf) out.buffer = `${buf[1]}MB`;
  const size = name.match(REGEX.size_inch);
  if (size) out.size_inch = size[1];
  return out;
}

async function main() {
  const { createSupabaseServiceClient } = await import("../src/utils/supabase");
  const supabase = createSupabaseServiceClient();

  const { data: attributes, error: attrError } = await supabase
    .from("attributes")
    .select("id, slug")
    .in("slug", ["capacity", "rpm", "buffer", "size_inch"]);

  if (attrError || !attributes?.length) {
    throw new Error(attrError?.message ?? "Could not load attributes");
  }

  const attrBySlug = new Map(attributes.map((a) => [a.slug as AttributeSlug, a.id]));

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name")
    .eq("category_id", HARD_DISK_CATEGORY_ID);

  if (productsError) throw new Error(productsError.message);
  if (!products?.length) {
    console.log("No products found in Hard Disk category.");
    return;
  }

  const { data: existing } = await supabase
    .from("product_attributes")
    .select("product_id, attribute_id")
    .in("product_id", products.map((p) => p.id));

  const existingSet = new Set(
    (existing ?? []).map((r) => `${r.product_id}:${r.attribute_id}`)
  );

  let inserted = 0;
  let skipped = 0;

  for (const product of products) {
    const name = product.name ?? "";
    const specs = extractSpecs(name);

    for (const [slug, value] of Object.entries(specs)) {
      if (!value) continue;
      const attributeId = attrBySlug.get(slug as AttributeSlug);
      if (!attributeId) continue;
      const key = `${product.id}:${attributeId}`;
      if (existingSet.has(key)) {
        skipped += 1;
        continue;
      }
      const { error } = await supabase.from("product_attributes").insert({
        product_id: product.id,
        attribute_id: attributeId,
        value
      });
      if (error) {
        console.error(`Insert failed for product ${product.id} ${slug}:`, error.message);
        continue;
      }
      existingSet.add(key);
      inserted += 1;
    }
  }

  console.log(`Products scanned: ${products.length}`);
  console.log(`Attributes inserted: ${inserted}`);
  console.log(`Skipped (already exist): ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
