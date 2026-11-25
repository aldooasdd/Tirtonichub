// Script Konten (22 Nov 2026): aturan murni (diuji di script.test.ts). Penyimpanan & izin di src/server/actions/script.ts.
// Keputusan Zaki 22 Nov 2026: hanya Video review (vrv), Video event (evt) & sejak 25 Nov 2026 Video IDCC (idc) yang punya Content ID; semua anggota media boleh
// menulis; Creative Review script disetujui admin / Admin 2 yang bukan penulisnya (admin penuh boleh dengan alasan);
// status script tidak menahan tahap FlowSpace; script baru diawali foto barang utama.

export const SCRIPT_TYPES = ["vrv", "evt", "idc"] as const;
export type ScriptStatus = "draft" | "review" | "revision" | "approved";
export const SCRIPT_ST: Record<ScriptStatus, string> = { draft: "Draft", review: "Creative Review Script", revision: "Perlu revisi", approved: "Disetujui" };

export type TaskLite = { id: string; type: string; cprId: string | null; extra?: unknown };
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Kartu boleh punya script: jenis vrv/evt, punya Content ID, tidak ditangguhkan/digabung. */
export function scriptEligible(t: TaskLite | null | undefined): string | null {
  if (!t) return "Kartu tidak ditemukan.";
  if (!(SCRIPT_TYPES as readonly string[]).includes(t.type)) return "Script Konten hanya untuk Video review, Video event, dan Video IDCC.";
  if (!t.cprId) return "Kartu ini belum punya Content ID.";
  const ex = obj(t.extra);
  if (ex.mergedInto) return "Kartu ini sudah digabung ke kartu lain.";
  return null;
}

// ---------- Validasi isi dokumen (JSON Tiptap). Tidak ada HTML mentah yang disimpan; atribut dibatasi supaya aman dari XSS. ----------
const NODES = new Set(["doc", "paragraph", "heading", "text", "bulletList", "orderedList", "listItem", "taskList", "taskItem", "blockquote", "horizontalRule", "hardBreak", "image", "table", "tableRow", "tableCell", "tableHeader", "codeBlock"]);
const MARKS = new Set(["bold", "italic", "underline", "strike", "code", "link", "textStyle", "highlight"]);
export const FONTS = ["DM Sans", "Manrope", "Arial", "Georgia", "Times New Roman", "Courier New", "Verdana"];
export const IMG_SRC = /^\/api\/file\?key=[A-Za-z0-9/_.\-%]{1,300}$/;
export const IMG_REF = /^(item|asset):[A-Za-z0-9_-]{1,40}$/;
const SAFE_STYLE = /^[#a-zA-Z0-9 .,%()-]{0,40}$/; // warna, ukuran, jarak baris: tanpa ; < > " url( expression(
const MAX_BYTES = 1_500_000;

function attrWhy(kind: string, name: string, a: Record<string, unknown>): string | null {
  for (const [k, v] of Object.entries(a)) {
    if (v == null || typeof v === "boolean" || typeof v === "number") continue;
    if (Array.isArray(v) && v.length <= 20 && v.every((x) => typeof x === "number")) continue; // lebar kolom tabel
    if (typeof v !== "string") return `atribut ${name}.${k} tidak valid`;
    if (name === "link" && k === "href") {
      if (!/^(https?:\/\/|mailto:)[^\s<>"]{1,1000}$/i.test(v)) return "link hanya boleh http(s) atau mailto";
      continue;
    }
    if (name === "link" && ["target", "rel", "class"].includes(k)) continue;
    if (name === "image" && k === "src") {
      if (!IMG_SRC.test(v)) return "gambar hanya boleh dari file Tirtonic";
      continue;
    }
    if (name === "image" && k === "ref") {
      if (!IMG_REF.test(v)) return "rujukan gambar tidak valid";
      continue;
    }
    if (["alt", "title"].includes(k)) {
      if (v.length > 200 || /[<>]/.test(v)) return "teks gambar tidak valid";
      continue;
    }
    if (k === "fontFamily") {
      if (!FONTS.includes(v.replace(/["']/g, ""))) return "font tidak dikenal";
      continue;
    }
    if (!SAFE_STYLE.test(v) || /url\(|expression\(/i.test(v)) return `atribut ${name}.${k} tidak aman`;
  }
  void kind;
  return null;
}

/** null = isi dokumen sah. */
export function contentWhy(doc: unknown): string | null {
  let s: string;
  try {
    s = JSON.stringify(doc);
  } catch {
    return "dokumen tidak valid";
  }
  if (!s || s.length > MAX_BYTES) return "dokumen terlalu besar (maks ±1,5 MB)";
  const d = obj(doc);
  if (d.type !== "doc") return "dokumen tidak valid";
  let count = 0;
  const walk = (n: unknown, depth: number): string | null => {
    if (++count > 60000 || depth > 40) return "dokumen terlalu rumit";
    const o = obj(n);
    const type = String(o.type ?? "");
    if (!NODES.has(type)) return `bagian dokumen "${type}" tidak didukung`;
    if (o.text != null && (typeof o.text !== "string" || o.text.length > 100000)) return "teks tidak valid";
    const w = attrWhy("node", type, obj(o.attrs));
    if (w) return w;
    if (o.marks != null) {
      if (!Array.isArray(o.marks)) return "format teks tidak valid";
      for (const m of o.marks) {
        const mm = obj(m);
        if (!MARKS.has(String(mm.type))) return `format "${String(mm.type)}" tidak didukung`;
        const w2 = attrWhy("mark", String(mm.type), obj(mm.attrs));
        if (w2) return w2;
      }
    }
    if (o.content != null) {
      if (!Array.isArray(o.content)) return "dokumen tidak valid";
      for (const c of o.content) {
        const w3 = walk(c, depth + 1);
        if (w3) return w3;
      }
    }
    return null;
  };
  return walk(d, 0);
}

/** Teks polos (untuk pencarian & ringkasan). */
export function plainText(doc: unknown, max = 4000): string {
  const out: string[] = [];
  let len = 0;
  const walk = (n: unknown) => {
    if (len > max) return;
    const o = obj(n);
    if (typeof o.text === "string") {
      out.push(o.text);
      len += o.text.length;
    }
    if (Array.isArray(o.content)) {
      for (const c of o.content) walk(c);
      if (["paragraph", "heading", "listItem", "taskItem"].includes(String(o.type))) out.push(" ");
    }
  };
  walk(doc);
  return out.join("").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Dokumen awal: foto barang utama (bila ada) lalu kerangka yang bisa diubah bebas. */
export function seedDoc(type: string, photo: { src: string; ref: string } | null): Record<string, unknown> {
  const p = (text?: string) => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });
  const h = (text: string) => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] });
  const media = photo
    ? { type: "paragraph", content: [{ type: "image", attrs: { src: photo.src, ref: photo.ref, alt: "Foto barang", width: 280 } }] }
    : { type: "paragraph", content: [{ type: "text", marks: [{ type: "italic" }], text: "Belum ada foto yang terhubung dengan Content ID ini." }] };
  const body = type === "evt" ? ["Opening", "Isi acara", "Penutup & CTA"] : ["Opening / Hook", "Penjelasan fitur", "Penutup & CTA"];
  return { type: "doc", content: [media, ...body.flatMap((t) => [h(t), p(), { type: "paragraph", content: [{ type: "text", marks: [{ type: "bold" }], text: "Visual: " }] }])] };
}

/** Perbarui alamat gambar dari rujukannya (foto barang/file diganti) tanpa menyentuh teks. Idempoten. */
export function refreshImages(doc: unknown, srcOf: (ref: string) => string | null | undefined): { doc: unknown; changed: boolean } {
  let changed = false;
  const walk = (n: unknown): unknown => {
    const o = obj(n);
    if (!Object.keys(o).length) return n;
    let out = o;
    if (o.type === "image") {
      const a = obj(o.attrs);
      const ref = typeof a.ref === "string" ? a.ref : "";
      const src = ref ? srcOf(ref) : undefined;
      if (src && src !== a.src) {
        changed = true;
        out = { ...o, attrs: { ...a, src } };
      }
    }
    if (Array.isArray(o.content)) {
      const c = o.content.map(walk);
      if (c.some((x, i) => x !== (o.content as unknown[])[i])) out = { ...out, content: c };
    }
    return out;
  };
  const res = walk(doc);
  return { doc: res, changed };
}

/** Simpan otomatis membuat versi riwayat bila versi terakhir sudah >15 menit atau dari orang lain. */
export function needSnapshot(last: { byId: string; createdAt: Date } | null, userId: string, now: Date): boolean {
  if (!last) return true;
  return last.byId !== userId || now.getTime() - last.createdAt.getTime() > 15 * 60 * 1000;
}

export type Actor = { userId: string; canManage: boolean; full: boolean };

/** Ajukan ke Creative Review: dari draft/revisi. */
export function submitWhy(status: string): string | null {
  return status === "draft" || status === "revision" ? null : status === "review" ? "Script sudah diajukan." : "Script sudah disetujui. Ubah isinya dulu untuk mengajukan versi baru.";
}

/** Keputusan Creative Review script. */
export function reviewWhy(a: Actor, doc: { status: string; writers: string[] }, decision: string, note: string, exc: string): string | null {
  if (!a.canManage) return "Hanya admin dan Admin 2 yang bisa memutuskan Creative Review Script.";
  if (doc.status !== "review") return "Script belum diajukan ke Creative Review Script.";
  if (decision !== "approve" && decision !== "revise") return "Keputusan tidak valid.";
  if (decision === "revise" && !note.trim()) return "Tulis catatan revisi dulu.";
  if (decision === "approve" && doc.writers.includes(a.userId)) {
    if (!a.full) return "Anda ikut menulis script ini, jadi tidak bisa menyetujuinya sendiri.";
    if (!exc.trim()) return "Anda ikut menulis script ini. Tulis alasan bila tetap menyetujui.";
  }
  return null;
}

/** Status setelah isi diubah: pengajuan/persetujuan lama tidak berlaku untuk isi baru (versi disetujui tetap tersimpan). */
export function statusAfterEdit(status: string): ScriptStatus {
  return status === "revision" ? "revision" : "draft";
}

/** Komentar: penulis komentar atau admin/Admin 2 boleh menyelesaikan; membuka lagi hanya admin/Admin 2. */
export function commentWhy(a: Actor, c: { byId: string; resolvedAt: Date | null }, act: "resolve" | "reopen"): string | null {
  if (act === "resolve") return c.resolvedAt ? "Komentar sudah selesai." : c.byId === a.userId || a.canManage ? null : "Hanya penulis komentar atau admin yang bisa menyelesaikan.";
  return !c.resolvedAt ? "Komentar masih terbuka." : a.canManage ? null : "Hanya admin dan Admin 2 yang bisa membuka lagi komentar.";
}
