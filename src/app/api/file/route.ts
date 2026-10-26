import { NextRequest } from "next/server";
import { getSession } from "@/server/auth/session";
import { getObjectStream } from "@/server/storage";

const MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", m4v: "video/x-m4v",
  pdf: "application/pdf",
};
const ctOf = (key: string) => MIME[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

// Sajikan objek dari S3/MinIO atau disk.
// nota/* = foto keuangan → wajib sesi, tidak di-cache.
// lainnya (foto produk/QC/barang/hasil konten) → publik + cache edge panjang.
// Kunci objek acak 96-bit (makeKey) jadi tak bisa ditebak; aman di-cache & dibagikan via URL.
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return new Response("key wajib", { status: 400 });

  const sensitive = key.startsWith("nota/");
  if (sensitive) {
    const session = await getSession();
    if (!session) return new Response("Unauthorized", { status: 401 });
  }

  const dlName = req.nextUrl.searchParams.get("name"); // hadir = paksa download
  try {
    // Range (mis. putar/geser video) → 206; tanpa Range → seluruh file, di-stream (aman untuk file GB).
    const m = /^bytes=(\d+)-(\d*)$/.exec(req.headers.get("range") ?? "");
    const r = await getObjectStream(key, m ? { start: Number(m[1]), end: m[2] ? Number(m[2]) : undefined } : undefined);
    const headers: Record<string, string> = {
      "content-type": ctOf(key),
      "cache-control": sensitive ? "private, max-age=300" : "public, max-age=31536000, immutable",
      "accept-ranges": "bytes",
      "content-length": String(r.end - r.start + 1),
    };
    if (m) headers["content-range"] = `bytes ${r.start}-${r.end}/${r.size}`;
    if (dlName) headers["content-disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(dlName)}`;
    return new Response(r.stream, { status: m ? 206 : 200, headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
