import { NextRequest } from "next/server";
import { getSession } from "@/server/auth/session";
import { getObject } from "@/server/storage";

const MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
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
    const buf = await getObject(key);
    const headers: Record<string, string> = {
      "content-type": ctOf(key),
      "cache-control": sensitive ? "private, max-age=300" : "public, max-age=31536000, immutable",
    };
    if (dlName) headers["content-disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(dlName)}`;
    return new Response(new Uint8Array(buf), { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
