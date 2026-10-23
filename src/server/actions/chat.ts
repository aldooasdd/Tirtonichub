"use server";

import { prisma } from "@/server/db";
import { requireAuth, can, assert } from "@/server/auth/rbac";
import { clientMeta } from "@/server/request-meta";
import { logActivity } from "@/server/activity-log";
import { makeKey, putObject } from "@/server/storage";

export type ActionResult = { ok: boolean; message?: string; id?: string };

const MAX_IMG = 500 * 1024;

async function assertMember(roomId: string, userId: string) {
  const m = await prisma.chatMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
  assert(!!m);
}

/** Buat grup + anggota. Hanya HR/Boss (PRD §11.5). */
export async function createGroup(name: string, memberIds: string[]): Promise<ActionResult> {
  const ctx = await requireAuth();
  assert(can.manageEmployees(ctx.activeRole)); // HR/Boss
  if (name.trim().length < 2) return { ok: false, message: "Nama grup minimal 2 karakter." };

  const ids = Array.from(new Set([ctx.userId, ...memberIds]));
  const room = await prisma.chatRoom.create({
    data: {
      type: "GROUP",
      name: name.trim(),
      createdById: ctx.userId,
      members: { create: ids.map((userId) => ({ userId })) },
    },
  });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "create", entity: "ChatRoom", entityId: room.id });
  return { ok: true, id: room.id };
}

export async function addMembers(roomId: string, memberIds: string[]): Promise<ActionResult> {
  const ctx = await requireAuth();
  assert(can.manageEmployees(ctx.activeRole));
  await prisma.chatMember.createMany({
    data: memberIds.map((userId) => ({ roomId, userId })),
    skipDuplicates: true,
  });
  return { ok: true };
}

export async function removeMember(roomId: string, userId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  assert(can.manageEmployees(ctx.activeRole));
  await prisma.chatMember.deleteMany({ where: { roomId, userId } });
  return { ok: true };
}

/** Buka/ buat DM dengan user lain. */
export async function startDM(otherUserId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  if (otherUserId === ctx.userId) return { ok: false, message: "Tidak bisa DM diri sendiri." };

  const mine = await prisma.chatMember.findMany({
    where: { userId: ctx.userId, room: { type: "DM" } },
    select: { roomId: true },
  });
  const existing = await prisma.chatRoom.findFirst({
    where: {
      type: "DM",
      id: { in: mine.map((m) => m.roomId) },
      members: { some: { userId: otherUserId } },
    },
  });
  if (existing) return { ok: true, id: existing.id };

  const room = await prisma.chatRoom.create({
    data: {
      type: "DM",
      createdById: ctx.userId,
      members: { create: [{ userId: ctx.userId }, { userId: otherUserId }] },
    },
  });
  return { ok: true, id: room.id };
}

export async function sendMessage(
  roomId: string,
  body: string,
  attachmentKey?: string,
): Promise<ActionResult> {
  const ctx = await requireAuth();
  await assertMember(roomId, ctx.userId);
  if (!body.trim() && !attachmentKey) return { ok: false, message: "Pesan kosong." };

  const msg = await prisma.chatMessage.create({
    data: {
      roomId,
      senderId: ctx.userId,
      body: body.trim() || null,
      attachmentKey: attachmentKey ?? null,
    },
  });
  // tandai terbaca utk pengirim
  await prisma.chatMember.update({
    where: { roomId_userId: { roomId, userId: ctx.userId } },
    data: { lastReadAt: new Date() },
  });
  return { ok: true, id: msg.id };
}

export async function uploadChatImage(form: FormData): Promise<{ ok: boolean; key?: string; message?: string }> {
  await requireAuth();
  const file = form.get("image");
  if (!(file instanceof File)) return { ok: false, message: "Gambar wajib." };
  if (file.size > MAX_IMG) return { ok: false, message: "Gambar terlalu besar (maks 500KB)." };
  if (!file.type.startsWith("image/")) return { ok: false, message: "Harus gambar." };
  const key = makeKey("chat", "jpg");
  await putObject(key, Buffer.from(await file.arrayBuffer()), file.type);
  return { ok: true, key };
}

export async function markRoomRead(roomId: string): Promise<{ ok: boolean }> {
  const ctx = await requireAuth();
  await prisma.chatMember.updateMany({
    where: { roomId, userId: ctx.userId },
    data: { lastReadAt: new Date() },
  });
  return { ok: true };
}
