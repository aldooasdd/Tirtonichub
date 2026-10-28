// File Konten bersifat pribadi: siapa boleh melihat folder, file, dan catatan.
// - Folder buatan sendiri: pemilik, orang yang dibagikan (share), atau siapa pun yang boleh melihat folder induknya.
// - Folder barang (id = id barang): admin/Admin 2, anggota yang punya tugas di barang itu, atau yang dibagikan
//   lewat folder barang itu sendiri atau folder kategorinya (folders/cat:{kategori}).
// - File & catatan mengikuti foldernya; yang di halaman utama hanya untuk pembuatnya.
import { prisma } from "@/server/db";
import type { Doc, StudioUser } from "./rules";

export type Access = {
  folder(k: string): boolean;
  docVisible(d: Doc | null | undefined): boolean;
  assetVisible(a: { itemId: string | null; folderId: string | null; createdById: string }): boolean;
};

export function sharedWith(u: StudioUser, d: Doc | null | undefined): boolean {
  const s = d?.share as { all?: unknown; codes?: unknown } | undefined;
  if (!s || typeof s !== "object") return false;
  if (s.all === true) return true;
  return !!u.code && Array.isArray(s.codes) && s.codes.includes(u.code);
}

export async function loadAccess(u: StudioUser): Promise<Access> {
  const [folders, items, mine] = await Promise.all([
    prisma.studioDoc.findMany({ where: { coll: "folders" }, select: { path: true, data: true } }),
    prisma.mediaItem.findMany({ select: { id: true, cat: true } }),
    u.code
      ? prisma.mediaTask.findMany({
          where: { itemId: { not: null }, OR: [{ producer: u.code }, { editor: u.code }, { talent: u.code }, { script: u.code }] },
          select: { itemId: true },
        })
      : Promise.resolve([] as { itemId: string | null }[]),
  ]);
  const F = new Map(folders.map((r) => [r.path.slice("folders/".length), r.data as Doc]));
  const cat = new Map(items.map((i) => [i.id, i.cat || "lainnya"]));
  const mineItems = new Set(mine.map((t) => t.itemId as string));
  const memo = new Map<string, boolean>();
  const folder = (k: string, depth = 0): boolean => {
    if (!k || depth > 60) return false;
    const m = memo.get(k);
    if (m !== undefined) return m;
    const d = F.get(k);
    let ok = false;
    if (d?.custom === true) ok = d.owner === u.email || sharedWith(u, d);
    else if (cat.has(k)) ok = u.staff || mineItems.has(k) || sharedWith(u, d) || sharedWith(u, F.get("cat:" + cat.get(k)));
    if (!ok && d?.parent) ok = folder(String(d.parent), depth + 1);
    memo.set(k, ok);
    return ok;
  };
  return {
    folder,
    docVisible: (d) => !!d && (d.owner === u.email || (!!d.parent && folder(String(d.parent)))),
    assetVisible: (a) => (a.folderId ? folder(a.folderId) : a.itemId ? folder(a.itemId) : a.createdById === u.userId),
  };
}
