/**
 * Copy objects from Supabase Storage to Cloudflare R2.
 * Does NOT update database URLs — safe while the site still serves Supabase URLs.
 *
 * Default mode reads image paths from the database (fast, reliable for live images).
 * Use --full-scan to enumerate every object in storage buckets (slower, includes orphans).
 *
 * Examples:
 *   npx tsx scripts/migrate-supabase-storage-to-r2.ts --dry-run
 *   npx tsx scripts/migrate-supabase-storage-to-r2.ts --skip-existing
 *   npx tsx scripts/migrate-supabase-storage-to-r2.ts --full-scan
 *   npx tsx scripts/migrate-supabase-storage-to-r2.ts --bucket products --concurrency 8
 */
import dotenv from "dotenv";
import path from "path";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CATEGORY_IMAGES_BUCKET,
  HOMEPAGE_IMAGES_BUCKET,
  PRODUCT_IMAGES_BUCKET
} from "../src/lib/images/constants";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const FEEDS_BUCKET = "feeds";
const ALL_BUCKETS = [
  PRODUCT_IMAGES_BUCKET,
  CATEGORY_IMAGES_BUCKET,
  HOMEPAGE_IMAGES_BUCKET,
  FEEDS_BUCKET
] as const;

const PUBLIC_BUCKETS = new Set<string>([
  PRODUCT_IMAGES_BUCKET,
  CATEGORY_IMAGES_BUCKET,
  HOMEPAGE_IMAGES_BUCKET
]);

const STORAGE_PUBLIC_SEGMENT = "/storage/v1/object/public/";
const FEEDS_OBJECT_PATH = "olx.json";
const MAX_RETRIES = 5;

type BucketName = (typeof ALL_BUCKETS)[number];
type StorageObject = { bucket: BucketName; path: string };

type MigrateStats = {
  listed: number;
  copied: number;
  skipped: number;
  failed: number;
  bytes: number;
};

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function flagValue(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set in .env.local`);
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetries<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable =
        /gateway timeout|timeout|429|502|503|504|fetch failed|econnreset|etimedout/i.test(message);
      if (!retryable || attempt === MAX_RETRIES) break;
      const delayMs = attempt * 2000;
      console.warn(`[migrate] retry ${attempt}/${MAX_RETRIES} ${label}: ${message} (wait ${delayMs}ms)`);
      await sleep(delayMs);
    }
  }
  throw lastError;
}

function contentTypeForPath(objectPath: string): string {
  const lower = objectPath.toLowerCase();
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function r2ObjectKey(bucket: string, objectPath: string): string {
  return `${bucket}/${objectPath}`;
}

function parseSupabaseStoragePublicUrl(url: string): StorageObject | null {
  const idx = url.indexOf(STORAGE_PUBLIC_SEGMENT);
  if (idx === -1) return null;
  const rest = url.slice(idx + STORAGE_PUBLIC_SEGMENT.length).split("?")[0];
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  const bucket = rest.slice(0, slash);
  const objectPath = rest.slice(slash + 1);
  if (!ALL_BUCKETS.includes(bucket as BucketName) || !objectPath) return null;
  return { bucket: bucket as BucketName, path: objectPath };
}

function createR2Client(): S3Client {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY"),
      secretAccessKey: requireEnv("R2_SECRET_KEY")
    }
  });
}

async function r2ObjectExists(s3: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error: unknown) {
    const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
    if (name === "NotFound" || name === "NoSuchKey") return false;
    const status =
      error && typeof error === "object" && "$metadata" in error
        ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
        : undefined;
    if (status === 404) return false;
    throw error;
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
}

async function fetchAllUrls(
  supabase: SupabaseClient,
  table: "products" | "product_images" | "categories" | "homepage_blocks",
  column: string
): Promise<string[]> {
  const urls: string[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await withRetries(`select ${table}.${column} from=${from}`, async () => {
      const result = await supabase
        .from(table)
        .select(column)
        .not(column, "is", null)
        .range(from, from + pageSize - 1);
      if (result.error) throw new Error(result.error.message);
      return result;
    });

    const rows = data ?? [];
    for (const row of rows) {
      const value = (row as Record<string, string | null>)[column];
      if (value) urls.push(value);
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return urls;
}

async function collectObjectsFromDatabase(supabase: SupabaseClient): Promise<StorageObject[]> {
  const [productMain, productImages, categories, homepage] = await Promise.all([
    fetchAllUrls(supabase, "products", "main_image"),
    fetchAllUrls(supabase, "product_images", "image_url"),
    fetchAllUrls(supabase, "categories", "image_url"),
    fetchAllUrls(supabase, "homepage_blocks", "image_url")
  ]);

  const unique = new Map<string, StorageObject>();
  for (const url of [...productMain, ...productImages, ...categories, ...homepage]) {
    const parsed = parseSupabaseStoragePublicUrl(url);
    if (!parsed) continue;
    unique.set(`${parsed.bucket}/${parsed.path}`, parsed);
  }

  unique.set(`${FEEDS_BUCKET}/${FEEDS_OBJECT_PATH}`, {
    bucket: FEEDS_BUCKET,
    path: FEEDS_OBJECT_PATH
  });

  return Array.from(unique.values());
}

async function listFolderPage(
  supabase: SupabaseClient,
  bucket: BucketName,
  prefix: string,
  offset: number
) {
  return withRetries(`list ${bucket}/${prefix || "(root)"} offset=${offset}`, async () => {
    const { data, error } = await supabase.storage.from(bucket).list(prefix || undefined, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" }
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
}

async function collectObjectsFromStorageScan(
  supabase: SupabaseClient,
  buckets: BucketName[]
): Promise<StorageObject[]> {
  const unique = new Map<string, StorageObject>();
  const queue: Array<{ bucket: BucketName; prefix: string }> = buckets.map((bucket) => ({
    bucket,
    prefix: ""
  }));

  while (queue.length > 0) {
    const current = queue.shift()!;
    let offset = 0;

    while (true) {
      const entries = await listFolderPage(supabase, current.bucket, current.prefix, offset);
      if (entries.length === 0) break;

      for (const entry of entries) {
        const name = entry.name;
        if (!name) continue;
        const fullPath = current.prefix ? `${current.prefix}/${name}` : name;

        if (entry.id) {
          unique.set(`${current.bucket}/${fullPath}`, { bucket: current.bucket, path: fullPath });
          continue;
        }

        queue.push({ bucket: current.bucket, prefix: fullPath });
      }

      if (entries.length < 1000) break;
      offset += 1000;
      if (offset % 5000 === 0) {
        console.log(
          `[migrate] scan bucket=${current.bucket} prefix=${current.prefix || "(root)"} discovered=${unique.size}`
        );
      }
    }
  }

  return Array.from(unique.values());
}

async function downloadObject(
  supabase: SupabaseClient,
  supabaseUrl: string,
  bucket: BucketName,
  objectPath: string
): Promise<Buffer> {
  if (PUBLIC_BUCKETS.has(bucket)) {
    const url = `${supabaseUrl}${STORAGE_PUBLIC_SEGMENT}${bucket}/${objectPath}`;
    return withRetries(`fetch ${bucket}/${objectPath}`, async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return Buffer.from(await response.arrayBuffer());
    });
  }

  return withRetries(`download ${bucket}/${objectPath}`, async () => {
    const { data, error } = await supabase.storage.from(bucket).download(objectPath);
    if (error || !data) {
      throw new Error(error?.message ?? "download returned empty body");
    }
    return Buffer.from(await data.arrayBuffer());
  });
}

async function copyObjects(options: {
  supabase: SupabaseClient;
  supabaseUrl: string;
  s3: S3Client | null;
  r2Bucket: string;
  objects: StorageObject[];
  dryRun: boolean;
  skipExisting: boolean;
  concurrency: number;
}): Promise<MigrateStats> {
  const { supabase, supabaseUrl, s3, r2Bucket, objects, dryRun, skipExisting, concurrency } = options;
  const stats: MigrateStats = { listed: objects.length, copied: 0, skipped: 0, failed: 0, bytes: 0 };

  if (objects.length === 0) return stats;

  const byBucket = new Map<BucketName, number>();
  for (const object of objects) {
    byBucket.set(object.bucket, (byBucket.get(object.bucket) ?? 0) + 1);
  }
  console.log(
    `[migrate] objects=${objects.length} byBucket=${JSON.stringify(Object.fromEntries(byBucket))}`
  );
  console.log(`[migrate] sample: ${objects.slice(0, 5).map((o) => `${o.bucket}/${o.path}`).join(", ")}`);

  if (dryRun) {
    console.log("[migrate] dry-run — no uploads");
    return stats;
  }

  const r2 = s3!;

  await runWithConcurrency(objects, concurrency, async (object, index) => {
    const key = r2ObjectKey(object.bucket, object.path);

    try {
      if (skipExisting && (await r2ObjectExists(r2, r2Bucket, key))) {
        stats.skipped += 1;
        return;
      }

      const buffer = await downloadObject(supabase, supabaseUrl, object.bucket, object.path);
      await withRetries(`upload ${key}`, async () => {
        await r2.send(
          new PutObjectCommand({
            Bucket: r2Bucket,
            Key: key,
            Body: buffer,
            ContentType: contentTypeForPath(object.path)
          })
        );
      });

      stats.copied += 1;
      stats.bytes += buffer.length;

      if ((index + 1) % 250 === 0 || index + 1 === objects.length) {
        console.log(
          `[migrate] progress ${index + 1}/${objects.length} copied=${stats.copied} skipped=${stats.skipped} failed=${stats.failed}`
        );
      }
    } catch (error) {
      stats.failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[migrate] FAILED ${key}: ${message}`);
    }
  });

  return stats;
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const skipExisting = hasFlag("--skip-existing");
  const fullScan = hasFlag("--full-scan");
  const bucketFilter = flagValue("--bucket");
  const concurrency = Math.max(1, Number(flagValue("--concurrency") ?? "8") || 8);

  const r2Bucket = requireEnv("R2_BUCKET");
  const r2PublicUrl = requireEnv("R2_PUBLIC_URL");
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");

  let buckets: BucketName[] = [...ALL_BUCKETS];
  if (bucketFilter) {
    if (!ALL_BUCKETS.includes(bucketFilter as BucketName)) {
      throw new Error(`Unknown --bucket ${bucketFilter}. Use: ${ALL_BUCKETS.join(", ")}`);
    }
    buckets = [bucketFilter as BucketName];
  }

  const { createSupabaseServiceClient } = await import("../src/utils/supabase");
  const supabase = createSupabaseServiceClient();
  const s3 = dryRun ? null : createR2Client();

  console.log("[migrate] Supabase Storage → Cloudflare R2");
  console.log(
    `[migrate] mode=${dryRun ? "dry-run" : "copy"} source=${fullScan ? "full-scan" : "db"} skipExisting=${skipExisting} concurrency=${concurrency}`
  );
  console.log(`[migrate] r2Bucket=${r2Bucket} publicUrl=https://${r2PublicUrl.replace(/^https?:\/\//, "")}`);

  let objects: StorageObject[];
  if (fullScan) {
    console.log(`[migrate] scanning storage buckets: ${buckets.join(", ")}`);
    objects = await collectObjectsFromStorageScan(supabase, buckets);
  } else {
    console.log("[migrate] collecting image paths from database...");
    objects = await collectObjectsFromDatabase(supabase);
    if (bucketFilter) {
      objects = objects.filter((object) => object.bucket === bucketFilter);
    }
  }

  const stats = await copyObjects({
    supabase,
    supabaseUrl,
    s3,
    r2Bucket,
    objects,
    dryRun,
    skipExisting,
    concurrency
  });

  const mb = (stats.bytes / (1024 * 1024)).toFixed(2);
  console.log("\n[migrate] summary");
  console.log(
    JSON.stringify(
      {
        dryRun,
        source: fullScan ? "full-scan" : "db",
        listed: stats.listed,
        copied: stats.copied,
        skipped: stats.skipped,
        failed: stats.failed,
        bytes: stats.bytes,
        megabytes: mb
      },
      null,
      2
    )
  );

  if (!dryRun && stats.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
