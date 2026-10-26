import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

const BUCKET = process.env.S3_BUCKET ?? "";

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

// ponytail: dev tanpa S3/MinIO → simpan ke .data/uploads, disajikan via /api/file.
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

// ponytail: proxy lewat app (/api/file) alih-alih presigned langsung — MinIO
// internal tak perlu diekspos publik & tak ada masalah host di URL browser.
export async function fileUrl(key: string): Promise<string> {
  return `/api/file?key=${encodeURIComponent(key)}`;
}

/** Baca objek jadi Buffer (S3/MinIO atau disk fallback). */
export async function getObject(key: string): Promise<Buffer> {
  if (s3Configured()) {
    const r = await client().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const bytes = await r.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }
  return fs.readFile(safeKeyToPath(key));
}

// ---------- unggah bertahap (file besar, mis. video GB) ----------
// Klien memotong file (mis. 16 MB) karena Cloudflare Tunnel menolak > 100 MB per permintaan.
// S3/MinIO: multipart upload asli. Disk (dev): potongan ditempel berurutan.
export async function multipartStart(key: string, contentType: string): Promise<string> {
  if (s3Configured()) {
    const r = await client().send(new CreateMultipartUploadCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }));
    return r.UploadId!;
  }
  const p = safeKeyToPath(key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, Buffer.alloc(0));
  return "disk";
}

export async function multipartPart(key: string, uploadId: string, partNumber: number, body: Buffer): Promise<string> {
  if (s3Configured()) {
    const r = await client().send(new UploadPartCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId, PartNumber: partNumber, Body: body }));
    return r.ETag ?? "";
  }
  await fs.appendFile(safeKeyToPath(key), body);
  return "disk-" + partNumber;
}

export async function multipartFinish(key: string, uploadId: string, parts: { n: number; etag: string }[]): Promise<void> {
  if (!s3Configured()) return;
  await client().send(
    new CompleteMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts.sort((a, b) => a.n - b.n).map((p) => ({ PartNumber: p.n, ETag: p.etag })) },
    }),
  );
}

export async function multipartAbort(key: string, uploadId: string): Promise<void> {
  if (s3Configured()) await client().send(new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId })).catch(() => {});
  else await fs.rm(safeKeyToPath(key), { force: true });
}

/** Baca objek sebagai stream (tanpa memuat seluruh file ke memori); mendukung Range untuk putar video. */
export async function getObjectStream(key: string, range?: { start: number; end?: number }) {
  if (s3Configured()) {
    const head = await client().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    const size = Number(head.ContentLength ?? 0);
    const start = range ? Math.min(range.start, Math.max(0, size - 1)) : 0;
    const end = range ? Math.min(range.end ?? size - 1, size - 1) : size - 1;
    const r = await client().send(new GetObjectCommand({ Bucket: BUCKET, Key: key, ...(range ? { Range: `bytes=${start}-${end}` } : {}) }));
    return { stream: r.Body!.transformToWebStream(), size, start, end };
  }
  const p = safeKeyToPath(key);
  const size = (await fs.stat(p)).size;
  const start = range ? Math.min(range.start, Math.max(0, size - 1)) : 0;
  const end = range ? Math.min(range.end ?? size - 1, size - 1) : size - 1;
  return { stream: Readable.toWeb(createReadStream(p, { start, end })) as ReadableStream, size, start, end };
}
