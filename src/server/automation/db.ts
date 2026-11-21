// Penyimpanan otomasi di PostgreSQL (Prisma) + penghubung ke layanan bisnis yang sudah ada (kartu Studio, notifikasi).
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/server/db";
import { sendPush } from "@/server/push/send";
import type { AutoStore, Biz, Run, StepRec, Timer } from "./engine";
import { defaultPolicy, isPolicyKey, type Policy, type PolicyKey, type PolicyStatus } from "./policies";
import type { Graph } from "./types";

type Doc = Record<string, unknown>;
const json = (v: unknown) => v as Prisma.InputJsonValue;
const obj = (v: unknown): Doc => (v && typeof v === "object" && !Array.isArray(v) ? (v as Doc) : {});
const isUnique = (e: unknown) => (e as { code?: string })?.code === "P2002";

const toRun = (r: { id: string; workflowKey: string; version: number; eventId: string; entityId: string; status: string; cursor: string; waitKey: string | null; ctx: unknown; error: string | null; correlationId: string }): Run => ({
  id: r.id, workflowKey: r.workflowKey, version: r.version, eventId: r.eventId, entityId: r.entityId, status: r.status as Run["status"], cursor: r.cursor,
  waitKey: r.waitKey, ctx: obj(r.ctx), dryRun: false, error: r.error, correlationId: r.correlationId,
});
const DONE = ["completed", "failed", "needs_configuration", "skipped"];

export const dbStore: AutoStore = {
  async activeWorkflows() {
    const ws = await prisma.automationWorkflow.findMany({ where: { status: "published", activeVersion: { not: null } } });
    const vs = await prisma.automationWorkflowVersion.findMany({ where: { OR: ws.map((w) => ({ workflowKey: w.key, version: w.activeVersion! })) } });
    return vs.map((v) => ({ key: v.workflowKey, version: v.version, graph: v.graph as unknown as Graph }));
  },
  async versionGraph(key, version) {
    const v = await prisma.automationWorkflowVersion.findUnique({ where: { workflowKey_version: { workflowKey: key, version } } });
    return v ? (v.graph as unknown as Graph) : null;
  },
  async inboxTry(eventId, consumer) {
    try {
      await prisma.automationInbox.create({ data: { eventId, consumer } });
      return true;
    } catch (e) {
      if (isUnique(e)) return false;
      throw e;
    }
  },
  async createRun(r) {
    try {
      const x = await prisma.automationRun.create({ data: { workflowKey: r.workflowKey, version: r.version, eventId: r.eventId, entityId: r.entityId, status: r.status, cursor: r.cursor, waitKey: r.waitKey, ctx: json(r.ctx), correlationId: r.correlationId } });
      return toRun(x);
    } catch (e) {
      if (isUnique(e)) return null;
      throw e;
    }
  },
  async saveRun(r) {
    await prisma.automationRun.update({ where: { id: r.id }, data: { status: r.status, cursor: r.cursor, waitKey: r.waitKey, ctx: json(r.ctx), error: r.error, finishedAt: DONE.includes(r.status) ? new Date() : null } });
  },
  async waitingRuns(waitKey) {
    return (await prisma.automationRun.findMany({ where: { status: "waiting_for_human", waitKey } })).map(toRun);
  },
  async stepDone(runId, nodeId) {
    const s = await prisma.automationRunStep.findFirst({ where: { runId, nodeId, status: "completed" }, orderBy: { at: "desc" } });
    return s ? { runId, nodeId, status: "completed", handle: s.handle, result: obj(s.result), at: s.at } : null;
  },
  async addStep(st: StepRec) {
    await prisma.automationRunStep.create({ data: { runId: st.runId, nodeId: st.nodeId, status: st.status, handle: st.handle, result: json(st.result), at: st.at } });
  },
  async upsertTimer(t: Timer) {
    try {
      await prisma.automationTimer.create({ data: { key: t.key, kind: t.kind, entityId: t.entityId, dueAt: t.dueAt, payload: json(t.payload), runId: t.runId } });
      return true;
    } catch (e) {
      if (isUnique(e)) return false;
      throw e;
    }
  },
  async cancelTimers(prefix, keep) {
    const r = await prisma.automationTimer.updateMany({ where: { status: "pending", key: { startsWith: prefix, notIn: keep } }, data: { status: "cancelled" } });
    return r.count;
  },
  async claimDueTimers(now, limit) {
    // pending → firing secara atomik; dua pekerja tidak pernah mengambil timer yang sama
    const rows = await prisma.$queryRaw<{ id: string; key: string; kind: string; entityId: string; dueAt: Date; payload: unknown; runId: string | null }[]>`
      UPDATE "AutomationTimer" SET "status" = 'firing', "firedAt" = ${now}
      WHERE "id" IN (SELECT "id" FROM "AutomationTimer" WHERE "status" = 'pending' AND "dueAt" <= ${now} ORDER BY "dueAt" LIMIT ${limit} FOR UPDATE SKIP LOCKED)
      RETURNING "id", "key", "kind", "entityId", "dueAt", "payload", "runId"`;
    return rows.map((r) => ({ id: r.id, key: r.key, kind: r.kind as Timer["kind"], entityId: r.entityId, dueAt: r.dueAt, payload: obj(r.payload), runId: r.runId }));
  },
  async finishTimer(id, status) {
    await prisma.automationTimer.update({ where: { id }, data: { status } });
  },
  async deliveryTry(key) {
    try {
      await prisma.automationDelivery.create({ data: { key } });
      return true;
    } catch (e) {
      if (isUnique(e)) return false;
      throw e;
    }
  },
  async policy(key) {
    return getPolicy(key);
  },
  async audit(e) {
    await prisma.automationAudit.create({ data: { actorType: e.actorType, actorId: e.actorId, action: e.action, resourceType: e.resourceType, resourceId: e.resourceId, outcome: e.outcome.slice(0, 300), correlationId: e.correlationId, detail: e.detail ? json(e.detail) : undefined } });
  },
};

export async function getPolicy(key: PolicyKey): Promise<Policy> {
  const p = await prisma.automationPolicy.findUnique({ where: { key } });
  return p ? { key, status: p.status as PolicyStatus, config: obj(p.config), version: p.version } : defaultPolicy(key);
}
export async function allPolicies(): Promise<Policy[]> {
  const rows = await prisma.automationPolicy.findMany();
  const m = new Map(rows.map((r) => [r.key, r]));
  const { POLICIES } = await import("./policies");
  return (Object.keys(POLICIES) as PolicyKey[]).map((k) => {
    const r = m.get(k);
    return r && isPolicyKey(r.key) ? { key: k, status: r.status as PolicyStatus, config: obj(r.config), version: r.version } : defaultPolicy(k);
  });
}

export const dbBiz: Biz = {
  async getTask(id) {
    const { getRaw } = await import("@/server/studio/store");
    return getRaw("tasks/" + id);
  },
  async settings() {
    const { getRaw } = await import("@/server/studio/store");
    return (await getRaw("settings/main")) ?? {};
  },
  async assignIfEmpty(id, role, code) {
    // hanya mengisi PIC yang masih kosong (bersyarat di database → aman diulang)
    const where = role === "producer" ? { id, OR: [{ producer: null }, { producer: "" }] } : { id, OR: [{ editor: null }, { editor: "" }] };
    const r = await prisma.mediaTask.updateMany({ where, data: role === "producer" ? { producer: code } : { editor: code } });
    return r.count > 0;
  },
  async userIdsForCodes(codes) {
    if (!codes.length) return [];
    const ms = await prisma.mediaMember.findMany({ where: { code: { in: codes }, user: { isActive: true } }, select: { userId: true } });
    return [...new Set(ms.map((m) => m.userId))];
  },
  async staffUserIds() {
    const ms = await prisma.mediaMember.findMany({ where: { role: { in: ["ADMIN", "ADMIN2"] }, user: { isActive: true } }, select: { userId: true } });
    return ms.map((m) => m.userId);
  },
  async notify(userIds, m) {
    await sendPush(userIds, { type: m.type, title: m.title, body: m.body, url: m.url }, { record: true, wa: m.wa });
  },
  async hasSnapshot(taskId, cp) {
    return !!(await prisma.studioDoc.findUnique({ where: { path: "cpr/s_" + taskId + "_" + cp.replace("D+", "") }, select: { path: true } }));
  },
};
