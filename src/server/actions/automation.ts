"use server";
// Aksi halaman Otomasi. Izin dicek di server pada setiap aksi (tombol yang disembunyikan di UI tidak cukup).
// Pemetaan izin → peran yang SUDAH ada: semua (baca, ubah, uji, terbitkan, aturan, audit) = admin penuh saja.

import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/server/db";
import { requireMedia } from "@/server/auth/rbac";
import { mediaAccess } from "@/server/media/auth";
import { dryRun } from "@/server/automation/engine";
import { allPolicies, dbBiz, dbStore } from "@/server/automation/db";
import { BLOCKED_POLICIES, isPolicyKey, policyConfigWhy, policyReady, type Policy } from "@/server/automation/policies";
import { TEMPLATES_WF } from "@/server/automation/templates";
import { graphPolicies, validateGraph, type Issue } from "@/server/automation/validate";
import { automationEnabled, WORKER_FLAG } from "@/server/automation/worker";
import type { Graph } from "@/server/automation/types";

export type Perms = { read: boolean; edit: boolean; publish: boolean; test: boolean; runs: boolean; approvals: boolean; audit: boolean; policy: boolean };
type R<T = undefined> = { ok: true; data: T } | { ok: false; message: string };
const json = (v: unknown) => v as Prisma.InputJsonValue;

async function ctx() {
  const a = await requireMedia();
  const acc = await mediaAccess(a);
  const me = await prisma.user.findUnique({ where: { id: a.userId }, select: { fullName: true, nickname: true } });
  const full = acc.full; // keputusan Zaki 25 Nov 2026: Otomasi hanya admin penuh
  const perms: Perms = { read: full, edit: full, publish: full, test: full, runs: full, approvals: full, audit: full, policy: full };
  return { userId: a.userId, name: me?.nickname || me?.fullName || "?", perms };
}
const deny = (): { ok: false; message: string } => ({ ok: false, message: "Tidak diizinkan." });
async function audit(actorId: string, action: string, key: string, outcome: string, detail?: Record<string, unknown>) {
  await prisma.automationAudit.create({ data: { actorType: "user", actorId, action, resourceType: "workflow", resourceId: key, outcome, correlationId: "ui:" + Date.now(), detail: detail ? json(detail) : undefined } });
}
/** Draf awal lima workflow dibuat sekali (status draft; tidak ada yang terbit otomatis). */
async function ensureWorkflows() {
  const have = new Set((await prisma.automationWorkflow.findMany({ select: { key: true } })).map((w) => w.key));
  for (const t of TEMPLATES_WF) if (!have.has(t.key)) await prisma.automationWorkflow.create({ data: { key: t.key, name: t.name, module: t.module, draft: json(t.graph) } }).catch(() => {});
}
const hashOf = (g: Graph) => createHash("sha256").update(JSON.stringify(g)).digest("hex").slice(0, 16);
function readiness(g: Graph, pols: Policy[]) {
  const need = graphPolicies(g);
  return need.map((k) => ({ key: k, ready: policyReady(pols.find((p) => p.key === k)), blocked: BLOCKED_POLICIES.includes(k) }));
}

export async function loadAutomation(): Promise<R<{ perms: Perms; enabled: boolean; envForced: string | null; workflows: { key: string; name: string; module: string; status: string; activeVersion: number | null; draft: Graph; draftRev: number; updatedBy: string | null; updatedAt: string; versions: { version: number; publishedBy: string; publishedAt: string; hash: string }[]; issues: Issue[]; needs: { key: string; ready: boolean; blocked: boolean }[] }[]; policies: Policy[] }>> {
  const c = await ctx();
  if (!c.perms.read) return deny();
  await ensureWorkflows();
  const [ws, vs, pols] = await Promise.all([prisma.automationWorkflow.findMany({ orderBy: { module: "asc" } }), prisma.automationWorkflowVersion.findMany({ orderBy: { version: "desc" } }), allPolicies()]);
  return {
    ok: true,
    data: {
      perms: c.perms,
      enabled: await automationEnabled(),
      envForced: process.env.AUTOMATION_ENABLED === "0" || process.env.AUTOMATION_ENABLED === "1" ? process.env.AUTOMATION_ENABLED : null,
      policies: pols,
      workflows: ws.map((w) => {
        const g = w.draft as unknown as Graph;
        return {
          key: w.key, name: w.name, module: w.module, status: w.status, activeVersion: w.activeVersion, draft: g, draftRev: w.draftRev, updatedBy: w.updatedBy, updatedAt: w.updatedAt.toISOString(),
          versions: vs.filter((v) => v.workflowKey === w.key).map((v) => ({ version: v.version, publishedBy: v.publishedBy, publishedAt: v.publishedAt.toISOString(), hash: v.hash })),
          issues: validateGraph(g), needs: readiness(g, pols),
        };
      }),
    },
  };
}

/** Simpan draf (tidak memengaruhi versi terbit / run yang berjalan). Penjaga konkurensi: draftRev harus sama. */
export async function saveDraft(key: string, graph: Graph, rev: number): Promise<R<{ rev: number; issues: Issue[] }>> {
  const c = await ctx();
  if (!c.perms.edit) return deny();
  if (JSON.stringify(graph).length > 100_000) return { ok: false, message: "Graf terlalu besar." };
  const clean: Graph = { nodes: (graph.nodes ?? []).map((n) => ({ id: String(n.id), type: n.type, data: n.data ?? {}, position: { x: Math.round(Number(n.position?.x) || 0), y: Math.round(Number(n.position?.y) || 0) } })), edges: (graph.edges ?? []).map((e) => ({ id: String(e.id), source: String(e.source), target: String(e.target), sourceHandle: e.sourceHandle ?? null })) };
  const r = await prisma.automationWorkflow.updateMany({ where: { key, draftRev: rev }, data: { draft: json(clean), draftRev: rev + 1, updatedBy: c.name } });
  if (!r.count) return { ok: false, message: "Draf sudah diubah orang lain. Muat ulang halaman." };
  await audit(c.userId, "workflow.draft_saved", key, "ok");
  return { ok: true, data: { rev: rev + 1, issues: validateGraph(clean) } };
}

export async function testWorkflow(key: string, taskId: string): Promise<R<{ status: string; steps: { nodeId: string; status: string; handle: string | null; result: Record<string, unknown> }[] }>> {
  const c = await ctx();
  if (!c.perms.test) return deny();
  const w = await prisma.automationWorkflow.findUnique({ where: { key } });
  if (!w) return { ok: false, message: "Workflow tidak ditemukan." };
  const g = w.draft as unknown as Graph;
  const iss = validateGraph(g);
  if (iss.length) return { ok: false, message: "Perbaiki dulu: " + iss[0].msg };
  if (!(await prisma.mediaTask.findUnique({ where: { id: taskId }, select: { id: true } }))) return { ok: false, message: "Kartu tidak ditemukan." };
  const trig = g.nodes.find((n) => n.type === "trigger")!;
  const r = await dryRun(g, taskId, trig.data.event as never, { store: dbStore, biz: dbBiz, now: new Date() });
  await audit(c.userId, "workflow.tested", key, r.status, { taskId });
  return { ok: true, data: { status: r.status, steps: r.steps.map((s) => ({ nodeId: s.nodeId, status: s.status, handle: s.handle, result: s.result })) } };
}

/** Terbitkan draf sebagai versi baru yang tidak bisa diubah. Hanya bila graf sah dan semua aturan bisnisnya aktif. */
export async function publishWorkflow(key: string, rev: number): Promise<R<{ version: number }>> {
  const c = await ctx();
  if (!c.perms.publish) return deny();
  const w = await prisma.automationWorkflow.findUnique({ where: { key } });
  if (!w) return { ok: false, message: "Workflow tidak ditemukan." };
  if (w.draftRev !== rev) return { ok: false, message: "Draf sudah berubah. Muat ulang halaman." };
  const g = w.draft as unknown as Graph;
  const iss = validateGraph(g);
  if (iss.length) return { ok: false, message: "Graf belum valid: " + iss[0].msg };
  const notReady = readiness(g, await allPolicies()).filter((x) => !x.ready);
  if (notReady.length) return { ok: false, message: "Aturan belum dikonfigurasi: " + notReady.map((x) => x.key).join(", ") };
  try {
    const v = await prisma.$transaction(async (tx) => {
      const last = await tx.automationWorkflowVersion.findFirst({ where: { workflowKey: key }, orderBy: { version: "desc" } });
      const version = (last?.version ?? 0) + 1;
      await tx.automationWorkflowVersion.create({ data: { workflowKey: key, version, graph: json(g), hash: hashOf(g), publishedBy: c.name } });
      await tx.automationWorkflow.update({ where: { key }, data: { status: "published", activeVersion: version, updatedBy: c.name } });
      return version;
    });
    await audit(c.userId, "workflow.published", key, "v" + v);
    return { ok: true, data: { version: v } };
  } catch {
    return { ok: false, message: "Gagal menerbitkan (mungkin diterbitkan bersamaan). Coba lagi." };
  }
}

/** Nonaktifkan: tidak ada run baru. Run yang sedang menunggu tetap tercatat dan bisa dilanjutkan bila diaktifkan lagi. */
export async function disableWorkflow(key: string): Promise<R> {
  const c = await ctx();
  if (!c.perms.publish) return deny();
  const r = await prisma.automationWorkflow.updateMany({ where: { key, status: "published" }, data: { status: "disabled", updatedBy: c.name } });
  if (!r.count) return { ok: false, message: "Workflow belum terbit." };
  await audit(c.userId, "workflow.disabled", key, "ok");
  return { ok: true, data: undefined };
}

/** Saklar worker otomasi (bawaan mati). Hanya admin penuh, teraudit. */
export async function setWorker(on: boolean): Promise<R<{ enabled: boolean }>> {
  const c = await ctx();
  if (!c.perms.publish) return deny();
  await prisma.automationPolicy.upsert({ where: { key: WORKER_FLAG }, create: { key: WORKER_FLAG, status: on ? "active" : "disabled", config: {}, version: 1, updatedBy: c.name }, update: { status: on ? "active" : "disabled", updatedBy: c.name, version: { increment: 1 } } });
  await prisma.automationAudit.create({ data: { actorType: "user", actorId: c.userId, action: on ? "worker.enabled" : "worker.disabled", resourceType: "worker", resourceId: WORKER_FLAG, outcome: "ok", correlationId: "ui:" + Date.now() } });
  return { ok: true, data: { enabled: await automationEnabled() } };
}

export async function savePolicy(key: string, status: "active" | "disabled", config: Record<string, unknown>): Promise<R<Policy>> {
  const c = await ctx();
  if (!c.perms.policy) return deny();
  if (!isPolicyKey(key)) return { ok: false, message: "Aturan tidak dikenal." };
  if (BLOCKED_POLICIES.includes(key)) return { ok: false, message: "Aturan ini butuh definisi bisnis baru dan belum bisa diaktifkan." };
  if (status === "active") {
    const w = policyConfigWhy(key, config);
    if (w) return { ok: false, message: w };
  }
  const cur = await prisma.automationPolicy.findUnique({ where: { key } });
  const version = (cur?.version ?? 0) + 1;
  await prisma.automationPolicy.upsert({ where: { key }, create: { key, status, config: json(config), version, updatedBy: c.name }, update: { status, config: json(config), version, updatedBy: c.name } });
  await prisma.automationAudit.create({ data: { actorType: "user", actorId: c.userId, action: "policy." + status, resourceType: "policy", resourceId: key, outcome: "v" + version, correlationId: "ui:" + Date.now(), detail: json({ before: cur?.config ?? null, after: config }) } });
  return { ok: true, data: { key, status, config, version } };
}

export async function loadRuns(): Promise<R<{ id: string; workflowKey: string; version: number; entityId: string; title: string; status: string; error: string | null; startedAt: string; steps: { nodeId: string; status: string; handle: string | null; result: unknown; at: string }[] }[]>> {
  const c = await ctx();
  if (!c.perms.runs) return deny();
  const runs = await prisma.automationRun.findMany({ orderBy: { startedAt: "desc" }, take: 100, include: { steps: { orderBy: { at: "asc" } } } });
  const titles = new Map((await prisma.mediaTask.findMany({ where: { id: { in: runs.map((r) => r.entityId) } }, select: { id: true, title: true } })).map((t) => [t.id, t.title]));
  return { ok: true, data: runs.map((r) => ({ id: r.id, workflowKey: r.workflowKey, version: r.version, entityId: r.entityId, title: titles.get(r.entityId) ?? "(kartu dihapus)", status: r.status, error: r.error, startedAt: r.startedAt.toISOString(), steps: r.steps.map((s) => ({ nodeId: s.nodeId, status: s.status, handle: s.handle, result: s.result, at: s.at.toISOString() })) })) };
}

/** Kotak persetujuan: kartu yang menunggu keputusan orang (Creative Review diajukan, brief diajukan), dari data kartu sungguhan.
 *  Keputusan tetap dibuat di Detail kartu Studio (aturan & izin yang sama: cpr.ts / brief.ts). */
export async function loadApprovals(): Promise<R<{ id: string; title: string; type: string; cprId: string; kind: "review" | "brief"; since: string; ver: number; waitingRun: boolean }[]>> {
  const c = await ctx();
  if (!c.perms.approvals) return deny();
  const rows = await prisma.mediaTask.findMany({ where: { type: { in: ["igf", "vpr", "vrv", "evt"] }, status: { not: "Tayang" } }, select: { id: true, title: true, type: true, extra: true } });
  const waiting = new Set((await prisma.automationRun.findMany({ where: { status: "waiting_for_human" }, select: { entityId: true } })).map((r) => r.entityId));
  const out: { id: string; title: string; type: string; cprId: string; kind: "review" | "brief"; since: string; ver: number; waitingRun: boolean }[] = [];
  for (const t of rows) {
    const ex = (t.extra ?? {}) as Record<string, Record<string, unknown>>;
    const qa = ex.qa ?? {}, br = ex.brief ?? {}, sub = (qa.sub ?? {}) as Record<string, unknown>;
    if (qa.sys === 2 && qa.st === "submitted") out.push({ id: t.id, title: t.title, type: t.type, cprId: String(ex.cprId ?? ""), kind: "review", since: new Date(Number(sub.at) || 0).toISOString(), ver: Number(qa.ver) || 0, waitingRun: waiting.has(t.id) });
    if (br.st === "submitted") out.push({ id: t.id, title: t.title, type: t.type, cprId: String(ex.cprId ?? ""), kind: "brief", since: new Date(Number(br.at) || 0).toISOString(), ver: Number(br.v) || 1, waitingRun: false });
  }
  return { ok: true, data: out.sort((a, b) => a.since.localeCompare(b.since)) };
}

export async function loadAudit(): Promise<R<{ id: string; at: string; actorType: string; actorId: string; action: string; resourceType: string; resourceId: string; outcome: string; correlationId: string }[]>> {
  const c = await ctx();
  if (!c.perms.audit) return deny();
  const rows = await prisma.automationAudit.findMany({ orderBy: { at: "desc" }, take: 200 });
  const names = new Map((await prisma.user.findMany({ where: { id: { in: rows.filter((r) => r.actorType === "user").map((r) => r.actorId) } }, select: { id: true, fullName: true } })).map((u) => [u.id, u.fullName]));
  return { ok: true, data: rows.map((r) => ({ id: r.id, at: r.at.toISOString(), actorType: r.actorType, actorId: r.actorType === "user" ? names.get(r.actorId) ?? r.actorId : r.actorId, action: r.action, resourceType: r.resourceType, resourceId: r.resourceId, outcome: r.outcome, correlationId: r.correlationId })) };
}

/** Kartu untuk uji coba (dry run): kartu CPR terbaru. */
export async function testCards(): Promise<R<{ id: string; title: string; type: string; status: string }[]>> {
  const c = await ctx();
  if (!c.perms.test) return deny();
  const rows = await prisma.mediaTask.findMany({ where: { type: { in: ["igf", "vpr", "vrv", "evt"] } }, orderBy: { updatedAt: "desc" }, take: 40, select: { id: true, title: true, type: true, status: true } });
  return { ok: true, data: rows };
}
