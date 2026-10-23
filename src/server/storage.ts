import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET = process.env.S3_BUCKET ?? "";
const PRESIGN_TTL = Number(process.env.S3_PRESIGN_TTL_SEC) || 300;

function s3Configured(): boolean {
  return !!(
    process.env.S3_ENDPOINT &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    BUCKET
  );
}

let _client: S3Client | null = null;
function client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "us-east-1",
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}

// ponytail: dev tanpa S3/MinIO → simpan ke .data/uploads, disajikan via /api/dev-file.
// Produksi WAJIB set S3_* (MinIO di PC server). JANGAN pakai fallback disk di produksi.
const DEV_DIR = path.join(process.cwd(), ".data", "uploads");

function safeKeyToPath(key: string): string {
  const p = path.normalize(path.join(DEV_DIR, key));
  if (!p.startsWith(DEV_DIR)) throw new Error("key tidak valid");
  return p;
}

export function makeKey(prefix: string, ext = "jpg"): string {
  return `${prefix}/${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  if (s3Configured()) {
    await client().send(
      new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }),
    );
    return;
  }
  const p = safeKeyToPath(key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, body);
}

/** URL baca berumur pendek (presigned). Dev: route lokal. */
export async function fileUrl(key: string): Promise<string> {
  if (s3Configured()) {
    return getSignedUrl(client(), new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
      expiresIn: PRESIGN_TTL,
    });
  }
  return `/api/dev-file?key=${encodeURIComponent(key)}`;
}

/** Dev only: baca file dari disk. */
export async function readDevFile(key: string): Promise<Buffer> {
  if (s3Configured()) throw new Error("dev-file dimatikan saat S3 aktif");
  return fs.readFile(safeKeyToPath(key));
}
