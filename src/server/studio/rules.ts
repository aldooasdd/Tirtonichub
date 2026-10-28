// Aturan akses UI Tirtonic Studio (/studio): port dari firestore.rules repo tirtonic-studio.
// Fungsi murni, diuji di rules.test.ts. Server WAJIB memanggil ini sebelum baca/tulis.

export type Doc = Record<string, unknown>;

export type StudioUser = {
  userId: string;
  email: string; // huruf kecil
  name: string;
  code: string; // kode jobdesk Z/R/A/S ('' bila tidak ada)
  full: boolean; // admin penuh (BOSS atau MediaMember ADMIN)
  staff: boolean; // full atau ADMIN2
  idcc: boolean; // boleh Analisis IDCC
};

export const AV_COLORS = ["lime", "orange", "purple", "teal", "green", "pink"];
export const FILE_COLORS = ["", "red", "orange", "yellow", "green", "blue", "purple", "gray"];
export const AV_ANIMALS = ["", "cat", "dog", "panda", "fox", "rabbit", "koala", "tiger", "frog", "penguin", "monkey", "bear", "chick"];

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const changedKeys = (before: Doc, after: Doc) =>
  [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null),
  );
const jpOnly = (d: Doc | null) => !d || ((str(d.tier) || "JP") === "JP" && !d.seasonal);

const PEOPLE = ["Z", "R", "A", "S"];
function shareWhy(s: unknown): string | null {
  if (s === undefined || s === null) return null;
  if (typeof s !== "object" || Array.isArray(s)) return "pengaturan bagikan tidak valid";
  const o = s as Doc;
  if (Object.keys(o).some((k) => !["all", "codes"].includes(k))) return "pengaturan bagikan tidak valid";
  if (o.all !== undefined && typeof o.all !== "boolean") return "pengaturan bagikan tidak valid";
  if (o.codes !== undefined && (!Array.isArray(o.codes) || o.codes.some((c) => !PEOPLE.includes(str(c))))) return "nama tidak dikenal";
  return null;
}

export function canRead(u: StudioUser, path: string): boolean {
  const [col, id, sub] = path.split("/");
  switch (col) {
    case "members":
      return id === u.email || u.full;
    case "pcal":
      return id === u.email && (!sub || sub === "events");
    case "pins":
      return id === u.email;
    case "reports":
      return u.full;
    case "idcc":
      return u.idcc;
    case "locks":
      return u.staff;
    case "public":
    case "assets":
    case "folders":
    case "docs":
    case "items":
    case "photos":
    case "tasks":
    case "settings":
    case "logs":
      return true;
    default:
      return false;
  }
}

/** null = boleh; string = alasan ditolak. op 'set' tanpa before = membuat dokumen baru. */
export function canWrite(
  u: StudioUser,
  op: "set" | "update" | "delete",
  path: string,
  before: Doc | null,
  after: Doc | null,
): string | null {
  const parts = path.split("/");
  const [col, id] = parts;
  const deny = (why: string) => why;
  switch (col) {
    case "members": {
      if (u.full) return null;
      if (op !== "update" || id !== u.email || !before || !after) return deny("akun hanya diatur admin");
      const bad = changedKeys(before, after).filter((k) => !["avColor", "avAnimal", "avPhoto", "updatedAt"].includes(k));
      if (bad.length) return deny("isian akun ini tidak boleh diubah sendiri");
      if (!AV_COLORS.includes(str(after.avColor) || "lime")) return deny("warna avatar tidak dikenal");
      if (!AV_ANIMALS.includes(str(after.avAnimal))) return deny("avatar hewan tidak dikenal");
      if (str(after.avPhoto).length > 60000) return deny("foto profil terlalu besar");
      return null;
    }
    case "pcal": {
      if (id !== u.email) return deny("kalender pribadi hanya untuk pemiliknya");
      if (op === "delete" || !after) return parts.length === 4 ? null : deny("tidak boleh menghapus kalender");
      if (parts.length === 2) {
        if (Object.keys(after).some((k) => !["color", "notes", "updatedAt"].includes(k))) return deny("isian kalender tidak dikenal");
        if (!AV_COLORS.includes(str(after.color) || "lime")) return deny("warna kalender tidak dikenal");
        if (str(after.notes).length > 5000) return deny("catatan terlalu panjang");
        return null;
      }
      if (parts.length === 4 && parts[2] === "events") {
        if (Object.keys(after).some((k) => !["date", "title", "time", "color", "note", "updatedAt"].includes(k))) return deny("isian catatan tidak dikenal");
        if (str(after.date).length !== 10) return deny("tanggal tidak valid");
        const t = str(after.title);
        if (!t || t.length > 120) return deny("judul wajib, maks 120 huruf");
        if (str(after.time).length > 5 || str(after.note).length > 500) return deny("jam/catatan tidak valid");
        if (!AV_COLORS.includes(str(after.color))) return deny("warna tidak dikenal");
        return null;
      }
      return deny("alamat kalender tidak dikenal");
    }
    case "items": {
      if (op === "delete") return u.staff ? null : deny("hanya admin");
      if (u.full) return null;
      if (!before) {
        if (u.staff && jpOnly(after)) return null;
        if (u.idcc && after?.old === true && jpOnly(after)) return null;
        return deny(u.staff ? "kode Louis2 hanya diatur admin" : "hanya admin");
      }
      if (!u.staff) return deny("hanya admin");
      if (changedKeys(before, after ?? {}).some((k) => k === "tier" || k === "seasonal")) return deny("kode Louis2 hanya diatur admin");
      return null;
    }
    case "public":
    case "reports":
      return u.full ? null : deny("khusus admin");
    case "assets": {
      // File Konten: unggah lewat /api/studio/upload/*; semua anggota boleh ganti nama/warna/bagian; hapus = admin atau pengunggah
      if (op === "delete") return u.staff || before?.uploaderId === u.userId ? null : deny("hanya admin atau yang mengunggah");
      if (!before || !after) return deny("unggah file lewat tombol + File");
      if (changedKeys(before, after).some((k) => !["name", "color", "section", "updatedAt"].includes(k))) return deny("hanya nama, warna, dan bagian yang bisa diubah");
      const nm = str(after.name).trim();
      if (!nm || nm.length > 200 || /[\\/]/.test(nm)) return deny("nama file tidak valid");
      if (!FILE_COLORS.includes(str(after.color))) return deny("warna tidak dikenal");
      return null;
    }
    case "folders": {
      // File Konten: folder barang (id = id barang; hanya warna & letak) dan folder buatan sendiri (custom). Semua anggota.
      // Folder barang & kategori (cat:…) diatur admin/Admin 2; folder buatan sendiri diatur pembuatnya.
      const custom = (before ?? after)?.custom === true;
      if (op === "delete") return custom ? (before?.owner === u.email ? null : deny("hanya pembuat folder")) : u.staff ? null : deny("hanya admin");
      const d = after ?? {};
      if (!FILE_COLORS.includes(str(d.color))) return deny("warna tidak dikenal");
      if (str(d.parent).length > 60) return deny("letak folder tidak valid");
      const sh = shareWhy(d.share);
      if (sh) return deny(sh);
      if (!custom) {
        if (!u.staff) return deny("folder barang hanya diatur admin");
        return Object.keys(d).some((k) => !["color", "parent", "share", "updatedAt"].includes(k)) ? deny("isian folder tidak dikenal") : null;
      }
      if (before && before.owner !== u.email && changedKeys(before, d).some((k) => !["parent", "updatedAt"].includes(k))) return deny("hanya pembuat folder yang bisa mengubah");
      if (Object.keys(d).some((k) => !["name", "color", "parent", "custom", "owner", "share", "createdAt", "updatedAt"].includes(k))) return deny("isian folder tidak dikenal");
      const nm = str(d.name).trim();
      if (!nm || nm.length > 80 || /[\\/]/.test(nm)) return deny("nama folder tidak valid");
      if (!before) return d.custom === true && d.owner === u.email ? null : deny("pembuat folder tidak cocok");
      return d.custom === true && d.owner === before.owner ? null : deny("pembuat folder tidak bisa diubah");
    }
    case "pins": {
      // Akses cepat di Beranda: milik masing-masing
      if (id !== u.email) return deny("hanya milik sendiri");
      if (op === "delete") return null;
      const it = after?.items;
      if (Object.keys(after ?? {}).some((k) => !["items", "updatedAt"].includes(k)) || !Array.isArray(it) || it.length > 40) return deny("isian tidak dikenal");
      return it.every((x) => x && typeof x === "object" && ["f", "a", "d"].includes(str((x as Doc).t)) && str((x as Doc).id).length > 0 && str((x as Doc).id).length <= 80) ? null : deny("isian tidak dikenal");
    }
    case "docs": {
      // File Konten: catatan (Docs). Semua anggota boleh menulis; hapus = admin atau pembuat.
      if (op === "delete") return u.staff || before?.owner === u.email ? null : deny("hanya admin atau pembuat catatan");
      const d = after ?? {};
      if (Object.keys(d).some((k) => !["title", "body", "parent", "color", "owner", "createdAt", "updatedAt", "updatedBy"].includes(k))) return deny("isian catatan tidak dikenal");
      if (str(d.title).length > 120 || str(d.body).length > 200_000 || str(d.parent).length > 60) return deny("catatan terlalu panjang");
      if (!FILE_COLORS.includes(str(d.color))) return deny("warna tidak dikenal");
      if (!before) return d.owner === u.email ? null : deny("pembuat catatan tidak cocok");
      return d.owner === before.owner ? null : deny("pembuat catatan tidak bisa diubah");
    }
    case "idcc":
      if (op === "set" && !before && u.idcc) return null;
      return u.staff ? null : deny("hanya admin");
    case "photos":
    case "settings":
    case "logs":
    case "locks":
      return u.staff ? null : deny("hanya admin");
    case "tasks": {
      if (u.staff) return null;
      if (op === "delete") return deny("hanya admin");
      if (!before) {
        const d = after ?? {};
        const ok = u.idcc && d.source === "lama" && d.reason === "idcc" && ["idc", "idf"].includes(str(d.type)) && ["Rencana", "Terdata"].includes(str(d.status));
        return ok ? null : deny("hanya admin");
      }
      return memberStatusUpdate(u, before, after ?? {});
    }
    default:
      return deny("alamat data tidak dikenal");
  }
}

const EARLY = ["Rencana", "Siap Produksi", "Diproduksi", "Editing", "QC", "Terdata", "Ready"];
const MEMBER_TO = ["Terdata", "Diproduksi", "Editing", "Ready"];
const MEMBER_KEYS = ["status", "shotAt", "readyAt", "note", "driveUrl", "history", "updatedAt", "updatedBy"];

/** Anggota: hanya kartu miliknya, hanya status s.d. Ready, catatan, link file, riwayat. */
function memberStatusUpdate(u: StudioUser, before: Doc, after: Doc): string | null {
  if (!u.code || ![before.producer, before.editor, before.talent, before.script].includes(u.code)) return "bukan kartu Anda";
  if (changedKeys(before, after).some((k) => !MEMBER_KEYS.includes(k))) return "isian ini hanya untuk admin";
  if (!EARLY.includes(str(before.status)) || before.metaAt) return "kartu ini sudah diurus admin";
  if (!(MEMBER_TO.includes(str(after.status)) || after.status === before.status)) return "tahap ini hanya untuk admin";
  if (str(after.note).length > 1000 || str(after.driveUrl).length > 500) return "catatan/link terlalu panjang";
  if (Array.isArray(after.history) && after.history.length > 40) return "riwayat terlalu panjang";
  return null;
}
