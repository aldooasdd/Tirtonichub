// Baca/tulis dokumen UI Tirtonic Studio ke database Tirtonichub.
// Alamat dokumen sama seperti versi Firebase (items/{id}, tasks/{id}, members/{email}, ...).

import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/server/db";
import { makeKey, putObject } from "@/server/storage";
import { canRead, canWrite, type Doc, type StudioUser } from "./rules";
import * as M from "./map";

export class StudioError extends Error {
  constructor(public code: "permission-denied" | "not-found" | "invalid-argument" | "failed-precondition", msg: string) {
    super(msg);
  }
}

const json = (v: unknown) => v as Prisma.InputJsonValue;
export const newId = () => randomBytes(15).toString("base64url");

function parse(path: string): string[] {
  const p = String(path || "").split("/");
  if (p.length < 2 || p.length > 4 || p.some((x) => !x || x.length > 200 || /[\s\\]/.test(x))) throw new StudioError("invalid-argument", "Alamat data tidak valid.");
  return p;
}

async function userByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { mediaMember: true, roles: { include: { role: true } } } });
}

/** Isi dokumen tanpa cek izin (dipakai untuk cek aturan & hasil tulis). */
export async function getRaw(path: string): Promise<Doc | null> {
  const [col, id, sub, subId] = parse(path);
  switch (col) {
    case "members": {
      const u = await userByEmail(id);
      if (!u || !u.isActive) return null;
      const boss = u.roles.some((r) => r.role.code === "BOSS");
      if (!u.mediaMember && !boss) return null;
      return M.memberToDoc({ email: u.email, fullName: u.fullName, nickname: u.nickname, createdAt: u.createdAt, boss, m: u.mediaMember });
    }
    case "items": {
      const r = await prisma.mediaItem.findUnique({ where: { id } });
      return r ? M.itemToDoc(r) : null;
    }
    case "photos": {
      const r = await prisma.mediaItem.findUnique({ where: { id }, select: { photoKey: true, updatedAt: true } });
      return r?.photoKey ? { data: "/api/file?key=" + encodeURIComponent(r.photoKey), updatedAt: r.updatedAt.getTime() } : null;
    }
    case "tasks": {
      const r = await prisma.mediaTask.findUnique({ where: { id } });
      return r ? M.taskToDoc(r) : null;
    }
    case "settings": {
      const r = await prisma.mediaSettings.findUnique({ where: { id: 1 } });
      return r ? M.settingsToDoc(r) : null;
    }
    case "logs": {
      const r = id === "balance" ? await prisma.mediaBalanceLog.findUnique({ where: { id: 1 } }) : null;
      return r ? { entries: r.entries, updatedAt: r.updatedAt.getTime() } : null;
    }
    case "pcal": {
      const u = await prisma.user.findUnique({ where: { email: id.toLowerCase() }, select: { id: true } });
      if (!u) return null;
      if (!sub) {
        const r = await prisma.mediaPcal.findUnique({ where: { userId: u.id } });
        return r ? M.pcalToDoc(r) : null;
      }
      const e = sub === "events" && subId ? await prisma.personalCalEvent.findUnique({ where: { id: subId } }) : null;
      return e && e.userId === u.id ? M.pcalEventToDoc(e) : null;
    }
    default: {
      const r = await prisma.studioDoc.findUnique({ where: { path } });
      return r ? (r.data as Doc) : null;
    }
  }
}

export async function getDoc(u: StudioUser, path: string): Promise<Doc | null> {
  if (!canRead(u, path)) throw new StudioError("permission-denied", "Tidak diizinkan membaca data ini.");
  return getRaw(path);
}

/** set = timpa, update = gabung, delete = hapus. Aturan akses dicek di sini. */
export async function writeDoc(u: StudioUser, op: "set" | "update" | "delete", path: string, data: Doc | null): Promise<Doc | null> {
  const parts = parse(path);
  const [col, id, sub, subId] = parts;
  const before = await getRaw(path);
  if (op === "update" && !before) throw new StudioError("not-found", "Data tidak ditemukan.");
  const after = op === "delete" ? null : op === "update" ? { ...before, ...(data ?? {}) } : { ...(data ?? {}) };
  if (after) delete after.id;
  const why = canWrite(u, op, path, before, after);
  if (why) throw new StudioError("permission-denied", "Tidak diizinkan: " + why + ".");

  if (!after) {
    await removeDoc(col, id, sub, subId, path);
    await prisma.studioTombstone.upsert({ where: { path }, create: { path }, update: { deletedAt: new Date() } });
    return null;
  }
  switch (col) {
    case "members": {
      const usr = await userByEmail(id);
      if (!usr) throw new StudioError("failed-precondition", "Email " + id + " belum punya akun Tirtonichub. Minta HR membuat akunnya dulu.");
      const row = M.memberFromDoc(after, usr.id);
      const clash = await prisma.mediaMember.findFirst({ where: { code: row.code, NOT: { userId: usr.id } }, select: { userId: true } });
      if (clash) throw new StudioError("failed-precondition", "Kode jobdesk " + row.code + " sudah dipakai anggota lain.");
      const data = { ...row, extra: json(row.extra) };
      await prisma.mediaMember.upsert({ where: { userId: usr.id }, create: { userId: usr.id, ...data }, update: data });
      break;
    }
    case "items": {
      const row = M.itemFromDoc(after);
      const data = { ...row, extra: json(row.extra) };
      await prisma.mediaItem.upsert({ where: { id }, create: { id, ...data, createdById: u.userId }, update: data });
      break;
    }
    case "photos": {
      const m = /^data:image\/(\w+);base64,(.+)$/.exec(String(after.data ?? ""));
      if (!m) throw new StudioError("invalid-argument", "Foto tidak valid.");
      const key = makeKey("barang", m[1] === "jpeg" ? "jpg" : m[1]);
      await putObject(key, Buffer.from(m[2], "base64"), "image/" + m[1]);
      const r = await prisma.mediaItem.updateMany({ where: { id }, data: { photoKey: key } });
      if (!r.count) throw new StudioError("not-found", "Barang untuk foto ini tidak ditemukan.");
      break;
    }
    case "tasks": {
      const { row, itemId } = M.taskFromDoc(after);
      const okItem = itemId ? !!(await prisma.mediaItem.findUnique({ where: { id: itemId }, select: { id: true } })) : false;
      const data = { ...row, itemId: okItem ? itemId : null, extra: json(row.extra), history: row.history === undefined ? undefined : json(row.history) } as Prisma.MediaTaskUncheckedCreateInput;
      await prisma.mediaTask.upsert({ where: { id }, create: { ...data, id }, update: data });
      break;
    }
    case "settings": {
      const r = M.settingsFromDoc(after);
      const data = { ...r, jobdesk: r.jobdesk === undefined ? undefined : json(r.jobdesk), extra: json(r.extra) };
      await prisma.mediaSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
      break;
    }
    case "logs": {
      if (id !== "balance") throw new StudioError("invalid-argument", "Log tidak dikenal.");
      const entries = json(Array.isArray(after.entries) ? after.entries : []);
      await prisma.mediaBalanceLog.upsert({ where: { id: 1 }, create: { id: 1, entries }, update: { entries } });
      break;
    }
    case "pcal": {
      const usr = await prisma.user.findUnique({ where: { email: id.toLowerCase() }, select: { id: true } });
      if (!usr) throw new StudioError("not-found", "Akun tidak ditemukan.");
      if (!sub) {
        const data = { color: String(after.color || "lime"), notes: after.notes ? String(after.notes) : null };
        await prisma.mediaPcal.upsert({ where: { userId: usr.id }, create: { userId: usr.id, ...data }, update: data });
      } else {
        const data = M.pcalEventFromDoc(after);
        await prisma.personalCalEvent.upsert({ where: { id: subId }, create: { id: subId, userId: usr.id, ...data }, update: data });
      }
      break;
    }
    default:
      await prisma.studioDoc.upsert({ where: { path }, create: { path, coll: col, data: json(after) }, update: { data: json(after) } });
  }
  await prisma.studioTombstone.deleteMany({ where: { path } });
  return getRaw(path);
}

async function removeDoc(col: string, id: string, sub: string | undefined, subId: string | undefined, path: string) {
  switch (col) {
    case "members": {
      const usr = await userByEmail(id);
      if (usr) await prisma.mediaMember.deleteMany({ where: { userId: usr.id } });
      return;
    }
    case "items":
      await prisma.mediaItem.deleteMany({ where: { id } });
      return;
    case "photos":
      await prisma.mediaItem.updateMany({ where: { id }, data: { photoKey: null } });
      return;
    case "tasks":
      await prisma.mediaTask.deleteMany({ where: { id } });
      return;
    case "settings":
      await prisma.mediaSettings.deleteMany({ where: { id: 1 } });
      return;
    case "logs":
      await prisma.mediaBalanceLog.deleteMany({ where: { id: 1 } });
      return;
    case "pcal":
      if (sub === "events" && subId) await prisma.personalCalEvent.deleteMany({ where: { id: subId } });
      return;
    default:
      await prisma.studioDoc.deleteMany({ where: { path } });
  }
}

/** Semua dokumen yang boleh dibaca user dan berubah sejak `since` (0 = semua). Foto besar tidak ikut (diambil saat dibuka). */
export async function changes(u: StudioUser, since: number) {
  const gt = new Date(Math.max(0, since - 2000)); // tumpang-tindih 2 detik supaya tidak ada yang terlewat
  const docs: Record<string, Doc> = {};
  const [items, tasks, settings, log, misc, pcal, events, tombs] = await Promise.all([
    prisma.mediaItem.findMany({ where: { updatedAt: { gt } } }),
    prisma.mediaTask.findMany({ where: { updatedAt: { gt } } }),
    prisma.mediaSettings.findFirst({ where: { id: 1, updatedAt: { gt } } }),
    prisma.mediaBalanceLog.findFirst({ where: { id: 1, updatedAt: { gt } } }),
    prisma.studioDoc.findMany({ where: { updatedAt: { gt } } }),
    prisma.mediaPcal.findFirst({ where: { userId: u.userId, updatedAt: { gt } } }),
    prisma.personalCalEvent.findMany({ where: { userId: u.userId, updatedAt: { gt } } }),
    since ? prisma.studioTombstone.findMany({ where: { deletedAt: { gt } } }) : Promise.resolve([]),
  ]);
  for (const r of items) docs["items/" + r.id] = M.itemToDoc(r);
  for (const r of tasks) docs["tasks/" + r.id] = M.taskToDoc(r);
  if (settings) docs["settings/main"] = M.settingsToDoc(settings);
  if (log) docs["logs/balance"] = { entries: log.entries, updatedAt: log.updatedAt.getTime() };
  for (const r of misc) if (canRead(u, r.path)) docs[r.path] = r.data as Doc;
  if (pcal) docs["pcal/" + u.email] = M.pcalToDoc(pcal);
  for (const e of events) docs["pcal/" + u.email + "/events/" + e.id] = M.pcalEventToDoc(e);

  const users = await prisma.user.findMany({
    where: { isActive: true, ...(u.full ? {} : { id: u.userId }), OR: [{ updatedAt: { gt } }, { mediaMember: { updatedAt: { gt } } }] },
    include: { mediaMember: true, roles: { include: { role: true } } },
  });
  for (const usr of users) {
    const boss = usr.roles.some((r) => r.role.code === "BOSS");
    if (!usr.mediaMember && !boss) continue;
    docs["members/" + usr.email] = M.memberToDoc({ email: usr.email, fullName: usr.fullName, nickname: usr.nickname, createdAt: usr.createdAt, boss, m: usr.mediaMember });
  }
  const deleted = tombs.map((t) => t.path).filter((p) => canRead(u, p) && !docs[p]);
  return { docs, deleted };
}

/** Kunci penyeimbang otomatis (satu perangkat saja yang menulis dalam satu waktu). */
export async function acquire(u: StudioUser, path: string, holder: string, ttlMs: number) {
  if (!path.startsWith("locks/") || !u.staff) throw new StudioError("permission-denied", "Tidak diizinkan.");
  return prisma.$transaction(async (tx) => {
    const r = await tx.studioDoc.findUnique({ where: { path } });
    const d = (r?.data ?? {}) as { holder?: string; expiresAt?: number };
    const now = Date.now();
    if (d.holder && d.holder !== holder && (d.expiresAt ?? 0) > now) return { acquired: false };
    const data = json({ holder, expiresAt: now + Math.min(Math.max(ttlMs || 30000, 1000), 120000) });
    await tx.studioDoc.upsert({ where: { path }, create: { path, coll: "locks", data }, update: { data } });
    return { acquired: true };
  });
}
