// Worker otomasi: dipanggil pushTick tiap menit (src/server/push/jobs.ts) dan disentak segera setelah ada event baru.
// Hanya berjalan bila dinyalakan admin penuh di halaman Otomasi (bawaan MATI). AUTOMATION_ENABLED=0 di .env = saklar darurat
// (paksa mati), =1 = paksa nyala. Event tetap dicatat di outbox walau mati, jadi tidak hilang.
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/server/db";
import { advance, fireTimers, processEvent } from "./engine";
import { dbBiz, dbStore } from "./db";
import { isEventType, type AutoEvent, type Graph } from "./types";
import type { NewEvent } from "./events";
import { newCorrelationId } from "./events";

export const WORKER_FLAG = "worker.enabled";
export async function automationEnabled(): Promise<boolean> {
  if (process.env.AUTOMATION_ENABLED === "0") return false;
  if (process.env.AUTOMATION_ENABLED === "1") return true;
  const f = await prisma.automationPolicy.findUnique({ where: { key: WORKER_FLAG }, select: { status: true } });
  return f?.status === "active";
}
export const MAX_ATTEMPTS = 6;
const backoffMs = (n: number) => Math.min(60, 2 ** n) * 60_000; // 2, 4, 8, … maks 60 menit

/** Operasi tulis outbox untuk dipakai di dalam prisma.$transaction bersama perubahan kartu. */
export function outboxCreate(evs: NewEvent[]) {
  return prisma.automationEvent.createMany({
    data: evs.map((e) => ({ dedupeKey: e.dedupeKey, type: e.type, entityType: e.entityType, entityId: e.entityId, payload: e.payload as Prisma.InputJsonValue, correlationId: newCorrelationId() })),
    skipDuplicates: true,
  });
}

let running = false;
/** Sentakan segera (tidak menunggu tick berikut). Aman dipanggil berkali-kali. */
export function kickAutomation() {
  setTimeout(() => void automationTick().catch((e) => console.error("[automation]", e)), 200).unref?.();
}

export async function automationTick(now = new Date()): Promise<{ events: number; timers: number; resumed: number } | null> {
  if (running || !(await automationEnabled())) return null;
  running = true;
  try {
    const deps = { store: dbStore, biz: dbBiz, now };
    // 1) event baru (klaim atomik + sewa 5 menit agar tidak diproses dua pekerja)
    const evs = await prisma.$queryRaw<{ id: string; type: string; entityType: string; entityId: string; payload: unknown; correlationId: string; occurredAt: Date; attempts: number }[]>`
      UPDATE "AutomationEvent" SET "attempts" = "attempts" + 1, "nextAttemptAt" = ${new Date(now.getTime() + 5 * 60_000)}
      WHERE "id" IN (SELECT "id" FROM "AutomationEvent" WHERE "dispatchedAt" IS NULL AND "nextAttemptAt" <= ${now} ORDER BY "occurredAt" LIMIT 50 FOR UPDATE SKIP LOCKED)
      RETURNING "id", "type", "entityType", "entityId", "payload", "correlationId", "occurredAt", "attempts"`;
    for (const e of evs) {
      try {
        if (!isEventType(e.type)) throw new Error("event tidak dikenal");
        const ev: AutoEvent = { id: e.id, type: e.type, entityType: "task", entityId: e.entityId, payload: (e.payload ?? {}) as Record<string, unknown>, correlationId: e.correlationId, occurredAt: e.occurredAt };
        await processEvent(ev, deps);
        await prisma.automationEvent.update({ where: { id: e.id }, data: { dispatchedAt: new Date(), lastError: null } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const dead = e.attempts >= MAX_ATTEMPTS;
        await prisma.automationEvent.update({ where: { id: e.id }, data: dead ? { dispatchedAt: new Date(), lastError: "DEAD: " + msg.slice(0, 280) } : { lastError: msg.slice(0, 300), nextAttemptAt: new Date(now.getTime() + backoffMs(e.attempts)) } });
        console.error("[automation] event", e.type, e.id, dead ? "dihentikan" : "dicoba lagi", msg);
      }
    }
    // 2) run yang terhenti di tengah (mis. server mati saat berjalan) dilanjutkan; langkah selesai tidak diulang
    const stuck = await prisma.automationRun.findMany({ where: { status: "running", updatedAt: { lt: new Date(now.getTime() - 5 * 60_000) } }, take: 20 });
    for (const r of stuck) {
      const g = await dbStore.versionGraph(r.workflowKey, r.version);
      if (!g) continue;
      await advance({ id: r.id, workflowKey: r.workflowKey, version: r.version, eventId: r.eventId, entityId: r.entityId, status: "running", cursor: r.cursor, waitKey: r.waitKey, ctx: (r.ctx ?? {}) as Record<string, unknown>, dryRun: false, error: null, correlationId: r.correlationId }, g as Graph, deps);
    }
    // 3) timer jatuh tempo
    const t = await fireTimers(deps);
    return { events: evs.length, timers: t.sent + t.suppressed, resumed: stuck.length };
  } finally {
    running = false;
  }
}
