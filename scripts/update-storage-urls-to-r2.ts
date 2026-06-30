/**
 * Rewrite Supabase Storage public URLs in the database to Cloudflare R2 public URLs.
 * Run after migrate-supabase-storage-to-r2.ts has copied all objects.
 *
 * Examples:
 *   npx tsx scripts/update-storage-urls-to-r2.ts --dry-run
 *   npx tsx scripts/update-storage-urls-to-r2.ts
 */
import dotenv from "dotenv";
import path from "path";
import { getR2PublicBaseUrl } from "../src/lib/storage/r2";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const STORAGE_PUBLIC_SEGMENT = "/storage/v1/object/public/";
const BATCH_SIZE = 500;
const UPDATE_CONCURRENCY = 20;

type TableUpdate = {
  table: "products" | "product_images" | "categories" | "homepage_blocks";
  column: string;
  idColumn: string;
};

const TABLES: TableUpdate[] = [
  { table: "products", column: "main_image", idColumn: "id" },
  { table: "product_images", column: "image_url", idColumn: "id" },
  { table: "categories", column: "image_url", idColumn: "id" },
  { table: "homepage_blocks", column: "image_url", idColumn: "id" }
];

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set in .env.local`);
  return value;
}

function rewriteUrl(url: string, oldPrefix: string, newPrefix: string): string {
  if (!url.includes(oldPrefix)) return url;
  return url.replace(oldPrefix, newPrefix);
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker())
  );
}

async function updateTableUrls(options: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  config: TableUpdate;
  oldPrefix: string;
  newPrefix: string;
  dryRun: boolean;
}): Promise<{ scanned: number; updated: number }> {
  const { supabase, config, oldPrefix, newPrefix, dryRun } = options;
  let scanned = 0;
  let updated = 0;

  while (true) {
    const query = supabase
      .from(config.table)
      .select(`${config.idColumn}, ${config.column}`)
      .like(config.column, "%supabase.co/storage/v1/object/public/%")
      .limit(BATCH_SIZE);

    const { data, error } = dryRun
      ? await query.range(scanned, scanned + BATCH_SIZE - 1)
      : await query;

    if (error) throw new Error(`${config.table}: ${error.message}`);
    const rows = data ?? [];
    if (rows.length === 0) break;

    scanned += rows.length;

    if (dryRun) {
      if (rows.length < BATCH_SIZE) break;
      continue;
    }

    await runWithConcurrency(rows, UPDATE_CONCURRENCY, async (row) => {
      const currentUrl = String(row[config.column] ?? "");
      const nextUrl = rewriteUrl(currentUrl, oldPrefix, newPrefix);
      if (nextUrl === currentUrl) return;

      const { error: updateError } = await supabase
        .from(config.table)
        .update({ [config.column]: nextUrl })
        .eq(config.idColumn, row[config.idColumn]);

      if (updateError) {
        throw new Error(`${config.table} ${row[config.idColumn]}: ${updateError.message}`);
      }
      updated += 1;
    });

    if (rows.length < BATCH_SIZE) break;
  }

  if (dryRun) {
    updated = scanned;
  }

  return { scanned, updated };
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const oldPrefix = `${supabaseUrl}${STORAGE_PUBLIC_SEGMENT}`;
  const newPrefix = `${getR2PublicBaseUrl()}/`;

  const { createSupabaseServiceClient } = await import("../src/utils/supabase");
  const supabase = createSupabaseServiceClient();

  console.log("[urls] Supabase Storage URLs → R2 public URLs");
  console.log(`[urls] mode=${dryRun ? "dry-run" : "update"}`);
  console.log(`[urls] oldPrefix=${oldPrefix}`);
  console.log(`[urls] newPrefix=${newPrefix}`);

  const summary: Record<string, { scanned: number; updated: number }> = {};

  for (const config of TABLES) {
    console.log(`[urls] ${config.table}.${config.column}...`);
    const result = await updateTableUrls({
      supabase,
      config,
      oldPrefix,
      newPrefix,
      dryRun
    });
    summary[config.table] = result;
    console.log(`[urls] ${config.table} scanned=${result.scanned} updated=${result.updated}`);
  }

  console.log("\n[urls] summary");
  console.log(JSON.stringify({ dryRun, tables: summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
