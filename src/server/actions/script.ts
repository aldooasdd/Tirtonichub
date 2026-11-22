"use server";
// Script Konten (22 Nov 2026): satu dokumen utama per kartu Video review / Video event (Content ID), dibuka dari
// Script Konten, FlowSpace, dan CPR. Semua izin dicek di sini (server); aturan murni di src/lib/media/script.ts.
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/server/db";
import { requireMedia } from "@/server/auth/rbac";
import { mediaAccess } from "@/server/media/auth";
import { loadAccess } from "@/server/studio/access";
import { withKey } from "@/server/studio/lock";
import {
  commentWhy, contentWhy, needSnapshot, refreshImages, reviewWhy, scriptEligible, seedDoc, statusAfterEdit, submitWhy,
  type Actor,
} from "@/lib/media/script";

type R<T> = ({ ok: true } & T) | { ok: false; message: string };
const fail = (message: string) => ({ ok: false as const, message });
const json = (v: unknown) => v as Prisma.InputJsonValue;
const fileUrl = (key: string) => "/api/file?key=" + encodeURIComponent(key).replace(/%2F/g, "/");

async function actor() {
  const auth = await requireMedia();
  const acc = await mediaAccess(auth);
  const a: Actor = { userId: auth.userId, canManage: acc.canManage, full: acc.full };
  return { auth, acc, a };
}

async function nameMap(ids: string[]): Promise<Record<string, string>> {
  const u = await prisma.user.findMany({ where: { id: { in: [...new Set(ids)].filter(Boolean) } }, select: { id: true, nickname: true, fullName: true } });
  return Object.fromEntries(u.map((x) => [x.id, x.nickname || x.fullName.split(" ")[0] || x.fullName]));
}

/** Foto yang boleh dipakai di script kartu ini: foto barang utama + gambar di folder barang/kartu yang boleh dilihat pengguna. */
async function mediaFor(task: { id: string; itemId: string | null }, userId: string, acc: { full: boolean; canManage: boolean; code: string | null }) {
  const item = task.itemId ? await prisma.mediaItem.findUnique({ where: { id: task.itemId }, select: { id: true, name: true, photoKey: true } }) : null;
  const out: { ref: string; src: string; name: string }[] = [];
  if (item?.photoKey) out.push({ ref: "item:" + item.id, src: fileUrl(item.photoKey), name: "Foto barang · " + item.name });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, fullName: true } });
  const access = await loadAccess({ userId, email: (user?.email || "").toLowerCase(), name: user?.fullName || "", code: acc.code || "", full: acc.full, staff: acc.canManage, idcc: false });
  const assets = await prisma.mediaAsset.findMany({
    where: { mime: { startsWith: "image/" }, OR: [...(task.itemId ? [{ itemId: task.itemId }] : []), { taskId: task.id }] },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { id: true, name: true, key: true, itemId: true, folderId: true, createdById: true },
  });
  for (const x of assets) if (access.assetVisible(x)) out.push({ ref: "asset:" + x.id, src: fileUrl(x.key), name: x.name });
  return { item, media: out };
}

async function srcResolver(doc: unknown) {
  const refs = new Set<string>();
  JSON.stringify(doc, (k, v) => {
    if (k === "ref" && typeof v === "string") refs.add(v);
    return v;
  });
  const itemIds = [...refs].filter((r) => r.startsWith("item:")).map((r) => r.slice(5));
  const assetIds = [...refs].filter((r) => r.startsWith("asset:")).map((r) => r.slice(6));
  const [items, assets] = await Promise.all([
    itemIds.length ? prisma.mediaItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, photoKey: true } }) : [],
    assetIds.length ? prisma.mediaAsset.findMany({ where: { id: { in: assetIds } }, select: { id: true, key: true } }) : [],
  ]);
  const m = new Map<string, string>();
  for (const i of items) if (i.photoKey) m.set("item:" + i.id, fileUrl(i.photoKey));
  for (const x of assets) m.set("asset:" + x.id, fileUrl(x.key));
  return (ref: string) => m.get(ref);
}

export type ScriptPayload = Awaited<ReturnType<typeof loadPayload>>;

async function loadPayload(taskId: string, userId: string, acc: { full: boolean; canManage: boolean; code: string | null }) {
  const task = await prisma.mediaTask.findUnique({ where: { id: taskId } });
  const why = scriptEligible(task);
  if (!task || why) return { task: null, why: why || "Kartu tidak ditemukan." };
  const ex = (task.extra ?? {}) as Record<string, unknown>;
  const [{ item, media }, doc] = await Promise.all([mediaFor(task, userId, acc), prisma.scriptDoc.findUnique({ where: { taskId } })]);
  // Link Google Docs lama: milik kartu, atau kartu lain berjenis sama dari barang yang sama (sama dengan scriptOf di Studio).
  let gdoc = typeof ex.scriptUrl === "string" ? ex.scriptUrl : "";
  if (!gdoc && task.itemId) {
    const sib = await prisma.mediaTask.findMany({ where: { itemId: task.itemId, type: task.type, id: { not: task.id } }, select: { extra: true } });
    gdoc = sib.map((s) => (s.extra as Record<string, unknown> | null)?.scriptUrl).find((u): u is string => typeof u === "string" && !!u) || "";
  }
  const brief = (ex.brief as { ok?: { data?: Record<string, unknown>; v?: number } } | undefined)?.ok ?? null;
  const base = {
    id: task.id, cprId: task.cprId || "", title: task.title, type: task.type, status: task.status, item: item?.name || "", campaignId: typeof ex.campaignId === "string" ? ex.campaignId : "",
    producer: task.producer || "", editor: task.editor || "", talent: task.talent || "", script: task.script || "", shootPlan: task.shootPlan || "", deadline: task.readyBy || task.due || "",
    gdoc, brief: brief ? { v: brief.v ?? 1, data: brief.data ?? {} } : null,
  };
  if (!doc) return { task: base, why: null, doc: null, media, revisions: [], comments: [], reviews: [], names: {} as Record<string, string> };
  const src = await srcResolver(doc.content);
  const fresh = refreshImages(doc.content, src);
  const [revisions, comments, reviews] = await Promise.all([
    prisma.scriptRevision.findMany({ where: { docId: doc.id }, orderBy: { rev: "desc" }, select: { rev: true, kind: true, byId: true, createdAt: true, title: true } }),
    prisma.scriptComment.findMany({ where: { docId: doc.id }, orderBy: { createdAt: "asc" } }),
    prisma.scriptReview.findMany({ where: { docId: doc.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const names = await nameMap([doc.createdById, doc.updatedById, ...doc.writers, ...revisions.map((r) => r.byId), ...comments.flatMap((c) => [c.byId, c.resolvedById || ""]), ...reviews.map((r) => r.byId)]);
  return {
    task: base, why: null, media, names,
    doc: { id: doc.id, title: doc.title, content: fresh.doc, version: doc.version, status: doc.status, submittedRev: doc.submittedRev, approvedRev: doc.approvedRev, writers: doc.writers, updatedById: doc.updatedById, updatedAt: doc.updatedAt.getTime(), createdAt: doc.createdAt.getTime() },
    revisions: revisions.map((r) => ({ ...r, createdAt: r.createdAt.getTime() })),
    comments: comments.map((c) => ({ id: c.id, byId: c.byId, body: c.body, quote: c.quote, resolvedAt: c.resolvedAt?.getTime() ?? null, resolvedById: c.resolvedById, createdAt: c.createdAt.getTime() })),
    reviews: reviews.map((r) => ({ id: r.id, rev: r.rev, byId: r.byId, decision: r.decision, note: r.note, exc: r.exc, createdAt: r.createdAt.getTime() })),
  };
}

export async function loadScript(taskId: string): Promise<R<{ data: ScriptPayload }>> {
  const { auth, acc } = await actor();
  return { ok: true, data: await loadPayload(String(taskId), auth.userId, acc) };
}

/** Buat script (idempoten): bila sudah ada untuk kartu ini, yang lama dibuka; tidak pernah ada dua dokumen utama. */
export async function createScript(taskId: string): Promise<R<{ data: ScriptPayload }>> {
  const { auth, acc } = await actor();
  const task = await prisma.mediaTask.findUnique({ where: { id: String(taskId) } });
  const why = scriptEligible(task);
  if (why || !task) return fail(why || "Kartu tidak ditemukan.");
  await withKey("script:" + task.id, async () => {
    if (await prisma.scriptDoc.findUnique({ where: { taskId: task.id }, select: { id: true } })) return;
    const item = task.itemId ? await prisma.mediaItem.findUnique({ where: { id: task.itemId }, select: { id: true, photoKey: true } }) : null;
    const content = seedDoc(task.type, item?.photoKey ? { src: fileUrl(item.photoKey), ref: "item:" + item.id } : null);
    try {
      await prisma.$transaction(async (tx) => {
        const d = await tx.scriptDoc.create({ data: { taskId: task.id, cprId: task.cprId as string, title: "Script · " + task.title, content: json(content), writers: [auth.userId], createdById: auth.userId, updatedById: auth.userId } });
        await tx.scriptRevision.create({ data: { docId: d.id, rev: 1, kind: "create", title: d.title, content: json(content), byId: auth.userId } });
      });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e; // dibuat bersamaan oleh orang lain: pakai yang sudah ada
    }
  });
  return { ok: true, data: await loadPayload(task.id, auth.userId, acc) };
}

async function nextRev(tx: Prisma.TransactionClient, docId: string) {
  const last = await tx.scriptRevision.findFirst({ where: { docId }, orderBy: { rev: "desc" }, select: { rev: true, byId: true, createdAt: true } });
  return { last, rev: (last?.rev ?? 0) + 1 };
}

type SaveRes = R<{ version: number; status: string; savedAt: number }> | { ok: false; conflict: true; message: string; latest: { version: number; title: string; content: unknown; by: string; at: number } };

/** Simpan otomatis. Gagal bila versi di server sudah lebih baru (orang lain menyimpan) → tidak menimpa. */
export async function saveScript(docId: string, version: number, title: string, content: unknown, force = false): Promise<SaveRes> {
  const { a } = await actor();
  const t = String(title ?? "").trim().slice(0, 160) || "Script";
  // Salinan JSON murni: nilai dari klien bisa berupa objek khusus React yang tidak boleh disentuh Prisma.
  let plain: unknown;
  try {
    plain = JSON.parse(JSON.stringify(content));
  } catch {
    return fail("Dokumen tidak valid.");
  }
  content = plain;
  const why = contentWhy(content);
  if (why) return fail("Tidak bisa menyimpan: " + why + ".");
  return withKey("scriptdoc:" + docId, async () => {
    const cur = await prisma.scriptDoc.findUnique({ where: { id: String(docId) } });
    if (!cur) return fail("Script tidak ditemukan.");
    if (cur.version !== version && !force) {
      const n = await nameMap([cur.updatedById]);
      return { ok: false as const, conflict: true as const, message: "Script diubah " + (n[cur.updatedById] || "orang lain") + " sebelum Anda menyimpan.", latest: { version: cur.version, title: cur.title, content: cur.content, by: n[cur.updatedById] || "", at: cur.updatedAt.getTime() } };
    }
    const now = new Date();
    const status = statusAfterEdit(cur.status);
    const res = await prisma.$transaction(async (tx) => {
      const d = await tx.scriptDoc.update({
        where: { id: cur.id },
        data: {
          title: t, content: json(content), version: { increment: 1 }, status, updatedById: a.userId,
          submittedRev: status === "draft" ? null : cur.submittedRev,
          writers: cur.writers.includes(a.userId) ? undefined : { push: a.userId },
        },
      });
      const { last, rev } = await nextRev(tx, cur.id);
      if (needSnapshot(last, a.userId, now)) await tx.scriptRevision.create({ data: { docId: cur.id, rev, kind: "save", title: t, content: json(content), byId: a.userId } });
      return d;
    });
    return { ok: true as const, version: res.version, status: res.status, savedAt: res.updatedAt.getTime() };
  });
}

/** Ajukan versi yang tersimpan sekarang ke Creative Review. */
export async function submitScript(docId: string, version: number): Promise<R<{ data: ScriptPayload }>> {
  const { auth, acc } = await actor();
  const r = await withKey("scriptdoc:" + docId, async () => {
    const cur = await prisma.scriptDoc.findUnique({ where: { id: String(docId) } });
    if (!cur) return { err: "Script tidak ditemukan." };
    if (cur.version !== version) return { err: "Ada perubahan yang belum tersimpan atau belum termuat. Tunggu tersimpan, lalu coba lagi." };
    const why = submitWhy(cur.status);
    if (why) return { err: why };
    await prisma.$transaction(async (tx) => {
      const { rev } = await nextRev(tx, cur.id);
      await tx.scriptRevision.create({ data: { docId: cur.id, rev, kind: "submit", title: cur.title, content: json(cur.content), byId: auth.userId } });
      await tx.scriptDoc.update({ where: { id: cur.id }, data: { status: "review", submittedRev: rev, version: { increment: 1 } } });
    });
    return { taskId: cur.taskId };
  });
  if ("err" in r) return fail(r.err as string);
  return { ok: true, data: await loadPayload(r.taskId, auth.userId, acc) };
}

/** Keputusan Creative Review untuk revisi yang diajukan. */
export async function reviewScript(docId: string, decision: string, note: string, exc: string): Promise<R<{ data: ScriptPayload }>> {
  const { auth, acc, a } = await actor();
  const r = await withKey("scriptdoc:" + docId, async () => {
    const cur = await prisma.scriptDoc.findUnique({ where: { id: String(docId) } });
    if (!cur) return { err: "Script tidak ditemukan." };
    const why = reviewWhy(a, cur, String(decision), String(note ?? ""), String(exc ?? ""));
    if (why) return { err: why };
    const rev = cur.submittedRev ?? 0;
    await prisma.$transaction([
      prisma.scriptReview.create({ data: { docId: cur.id, rev, byId: a.userId, decision: String(decision), note: String(note ?? "").trim().slice(0, 2000) || null, exc: String(exc ?? "").trim().slice(0, 500) || null } }),
      prisma.scriptDoc.update({ where: { id: cur.id }, data: decision === "approve" ? { status: "approved", approvedRev: rev, version: { increment: 1 } } : { status: "revision", version: { increment: 1 } } }),
    ]);
    return { taskId: cur.taskId };
  });
  if ("err" in r) return fail(r.err as string);
  return { ok: true, data: await loadPayload(r.taskId, auth.userId, acc) };
}

export async function getRevision(docId: string, rev: number): Promise<R<{ title: string; content: unknown }>> {
  await actor();
  const r = await prisma.scriptRevision.findUnique({ where: { docId_rev: { docId: String(docId), rev: Number(rev) } } });
  if (!r) return fail("Versi tidak ditemukan.");
  const src = await srcResolver(r.content);
  return { ok: true, title: r.title, content: refreshImages(r.content, src).doc };
}

/** Pulihkan versi lama: isi sekarang diganti salinan versi itu (versi lain tetap tersimpan), status kembali Draft. */
export async function restoreRevision(docId: string, rev: number, version: number): Promise<R<{ data: ScriptPayload }>> {
  const { auth, acc } = await actor();
  const r = await withKey("scriptdoc:" + docId, async () => {
    const cur = await prisma.scriptDoc.findUnique({ where: { id: String(docId) } });
    const old = await prisma.scriptRevision.findUnique({ where: { docId_rev: { docId: String(docId), rev: Number(rev) } } });
    if (!cur || !old) return { err: "Versi tidak ditemukan." };
    if (cur.version !== version) return { err: "Ada perubahan yang belum termuat. Muat ulang dulu." };
    await prisma.$transaction(async (tx) => {
      const { rev: nr } = await nextRev(tx, cur.id);
      await tx.scriptRevision.create({ data: { docId: cur.id, rev: nr, kind: "restore", title: old.title, content: json(old.content), byId: auth.userId } });
      await tx.scriptDoc.update({ where: { id: cur.id }, data: { title: old.title, content: json(old.content), status: "draft", submittedRev: null, version: { increment: 1 }, updatedById: auth.userId, writers: cur.writers.includes(auth.userId) ? undefined : { push: auth.userId } } });
    });
    return { taskId: cur.taskId };
  });
  if ("err" in r) return fail(r.err as string);
  return { ok: true, data: await loadPayload(r.taskId, auth.userId, acc) };
}

export async function addComment(docId: string, body: string, quote: string): Promise<R<{ id: string }>> {
  const { a } = await actor();
  const b = String(body ?? "").trim();
  if (!b) return fail("Tulis komentar dulu.");
  if (b.length > 2000) return fail("Komentar maksimal 2000 huruf.");
  if (!(await prisma.scriptDoc.findUnique({ where: { id: String(docId) }, select: { id: true } }))) return fail("Script tidak ditemukan.");
  const c = await prisma.scriptComment.create({ data: { docId: String(docId), byId: a.userId, body: b, quote: String(quote ?? "").trim().slice(0, 300) || null } });
  return { ok: true, id: c.id };
}

export async function setComment(id: string, act: "resolve" | "reopen"): Promise<R<object>> {
  const { a } = await actor();
  const c = await prisma.scriptComment.findUnique({ where: { id: String(id) } });
  if (!c) return fail("Komentar tidak ditemukan.");
  const why = commentWhy(a, c, act === "reopen" ? "reopen" : "resolve");
  if (why) return fail(why);
  await prisma.scriptComment.update({ where: { id: c.id }, data: act === "reopen" ? { resolvedAt: null, resolvedById: null } : { resolvedAt: new Date(), resolvedById: a.userId } });
  return { ok: true };
}

/** Dicek berkala oleh editor yang terbuka: ada perubahan dari orang lain? */
export async function pollScript(docId: string): Promise<R<{ version: number; by: string; comments: number }>> {
  await actor();
  const d = await prisma.scriptDoc.findUnique({ where: { id: String(docId) }, select: { version: true, updatedById: true } });
  if (!d) return fail("Script tidak ditemukan.");
  const [n, comments] = await Promise.all([nameMap([d.updatedById]), prisma.scriptComment.count({ where: { docId: String(docId) } })]);
  return { ok: true, version: d.version, by: n[d.updatedById] || "", comments };
}
