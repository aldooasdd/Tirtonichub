// Penyimpanan tiruan di memori untuk pengujian mesin (meniru batasan unik di database).
import type { ActiveWf, AuditIn, AutoStore, Biz, Run, StepRec, Timer } from "./engine";
import { defaultPolicy, type Policy, type PolicyKey } from "./policies";
import type { Graph } from "./types";

type Doc = Record<string, unknown>;
export class MemDb {
  workflows = new Map<string, { version: number; graphs: Map<number, Graph>; since?: Date }>();
  inbox = new Set<string>();
  runs = new Map<string, Run>();
  runKeys = new Set<string>();
  steps: StepRec[] = [];
  timers: (Timer & { status: string })[] = [];
  deliveries = new Set<string>();
  policies = new Map<PolicyKey, Policy>();
  auditLog: AuditIn[] = [];
  tasks = new Map<string, Doc>();
  settingsDoc: Doc = {};
  sent: { userIds: string[]; title: string; body?: string; wa?: boolean }[] = [];
  assigned: { id: string; role: string; code: string }[] = [];
  snapshots = new Set<string>();
  n = 0;
  publish(key: string, g: Graph, since?: Date) {
    const w: { version: number; graphs: Map<number, Graph>; since?: Date } = this.workflows.get(key) ?? { version: 0, graphs: new Map() };
    w.version++;
    w.graphs.set(w.version, structuredClone(g));
    w.since = since;
    this.workflows.set(key, w);
  }
}
export function memStore(db: MemDb): AutoStore {
  return {
    activeWorkflows: async () => [...db.workflows].map(([key, w]): ActiveWf => ({ key, version: w.version, graph: w.graphs.get(w.version)!, since: w.since })),
    versionGraph: async (k, v) => db.workflows.get(k)?.graphs.get(v) ?? null,
    inboxTry: async (e, c) => (db.inbox.has(e + "|" + c) ? false : (db.inbox.add(e + "|" + c), true)),
    createRun: async (r) => {
      const k = r.workflowKey + ":" + r.version + ":" + r.eventId;
      if (db.runKeys.has(k)) return null;
      db.runKeys.add(k);
      const run = { ...r, id: "run" + ++db.n };
      db.runs.set(run.id, run);
      return { ...run };
    },
    saveRun: async (r) => void db.runs.set(r.id, { ...r }),
    waitingRuns: async (key) => [...db.runs.values()].filter((r) => r.status === "waiting_for_human" && r.waitKey === key).map((r) => ({ ...r })),
    stepDone: async (runId, nodeId) => db.steps.filter((x) => x.runId === runId && x.nodeId === nodeId && x.status === "completed").at(-1) ?? null,
    addStep: async (st) => void db.steps.push(st),
    upsertTimer: async (t) => (db.timers.some((x) => x.key === t.key) ? false : (db.timers.push({ ...t, id: "tm" + ++db.n, status: "pending" }), true)),
    cancelTimers: async (prefix, keep) => {
      let c = 0;
      for (const t of db.timers) if (t.status === "pending" && t.key.startsWith(prefix) && !keep.includes(t.key)) { t.status = "cancelled"; c++; }
      return c;
    },
    claimDueTimers: async (now) => {
      const out = db.timers.filter((t) => t.status === "pending" && t.dueAt <= now);
      out.forEach((t) => (t.status = "firing"));
      return out.map((t) => ({ ...t }));
    },
    finishTimer: async (id, st) => void (db.timers.find((t) => t.id === id)!.status = st),
    deliveryTry: async (k) => (db.deliveries.has(k) ? false : (db.deliveries.add(k), true)),
    policy: async (k) => db.policies.get(k) ?? defaultPolicy(k),
    audit: async (e) => void db.auditLog.push(e),
  };
}
export function memBiz(db: MemDb): Biz {
  return {
    getTask: async (id) => (db.tasks.has(id) ? structuredClone(db.tasks.get(id)!) : null),
    settings: async () => db.settingsDoc,
    assignIfEmpty: async (id, role, code) => {
      const t = db.tasks.get(id)!;
      if (t[role]) return false;
      t[role] = code;
      db.assigned.push({ id, role, code });
      return true;
    },
    userIdsForCodes: async (codes) => codes.map((c) => "u-" + c),
    staffUserIds: async () => ["u-Z", "u-A"],
    notify: async (userIds, m) => void db.sent.push({ userIds, title: m.title, body: m.body, wa: m.wa }),
    hasSnapshot: async (id, cp) => db.snapshots.has(id + ":" + cp),
  };
}
