import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client: S3Client | null = null;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCESS_KEY?.trim() &&
      process.env.R2_SECRET_KEY?.trim() &&
      process.env.R2_ACCOUNT_ID?.trim() &&
      process.env.R2_BUCKET?.trim() &&
      process.env.R2_PUBLIC_URL?.trim()
  );
}

export function getR2Bucket(): string {
  return requireEnv("R2_BUCKET");
}

/** `https://pub-….r2.dev` (no trailing slash). */
export function getR2PublicBaseUrl(): string {
  const raw = requireEnv("R2_PUBLIC_URL");
  return raw.startsWith("http") ? raw.replace(/\/$/, "") : `https://${raw.replace(/\/$/, "")}`;
}

export function getR2PublicHostname(): string {
  return new URL(getR2PublicBaseUrl()).hostname;
}

export function getR2Client(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requireEnv("R2_ACCESS_KEY"),
        secretAccessKey: requireEnv("R2_SECRET_KEY")
      }
    });
  }
  return client;
}

export function r2ObjectKey(bucket: string, objectPath: string): string {
  return `${bucket}/${objectPath}`;
}

export function getR2PublicUrl(bucket: string, objectPath: string): string {
  return `${getR2PublicBaseUrl()}/${bucket}/${objectPath}`;
}

export async function uploadR2Object(
  bucket: string,
  objectPath: string,
  body: Buffer,
  contentType: string,
  cacheControl?: string
): Promise<void> {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: r2ObjectKey(bucket, objectPath),
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl
    })
  );
}

export async function deleteR2ObjectPaths(bucket: string, objectPaths: string[]): Promise<void> {
  const unique = Array.from(new Set(objectPaths.filter(Boolean)));
  if (unique.length === 0) return;

  const chunkSize = 1000;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    try {
      await getR2Client().send(
        new DeleteObjectsCommand({
          Bucket: getR2Bucket(),
          Delete: {
            Objects: chunk.map((objectPath) => ({ Key: r2ObjectKey(bucket, objectPath) }))
          }
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[r2] delete ${bucket}:`, message);
    }
  }
}

/** Object paths relative to the logical bucket, e.g. `{productId}/0.webp`. */
export async function listR2ObjectPaths(bucket: string, folderPrefix: string): Promise<string[]> {
  const paths: string[] = [];
  const listPrefix = folderPrefix
    ? `${r2ObjectKey(bucket, folderPrefix)}/`
    : `${bucket}/`;
  const stripLen = bucket.length + 1;
  let continuationToken: string | undefined;

  do {
    const response = await getR2Client().send(
      new ListObjectsV2Command({
        Bucket: getR2Bucket(),
        Prefix: listPrefix,
        ContinuationToken: continuationToken
      })
    );

    for (const item of response.Contents ?? []) {
      if (!item.Key || item.Key.endsWith("/")) continue;
      paths.push(item.Key.slice(stripLen));
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return paths;
}

export async function createR2PresignedGetUrl(
  bucket: string,
  objectPath: string,
  expiresInSeconds: number
): Promise<string> {
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: getR2Bucket(),
      Key: r2ObjectKey(bucket, objectPath)
    }),
    { expiresIn: expiresInSeconds }
  );
}
