// Mesin workflow: menjalankan graf versi terbit (immutable) untuk satu event. Tahan ulang (replay-safe):
// - run unik per (workflow, versi, event); inbox mencegah event diproses dua kali
// - langkah yang sudah selesai tidak dijalankan ulang (hasilnya dibaca dari riwayat langkah)
// - efek samping punya kunci unik (pengiriman notifikasi, timer) atau bersyarat (isi PIC hanya bila kosong)
// - menunggu keputusan orang / timer disimpan di database, jadi bertahan saat server restart.
// Semua akses data lewat antarmuka AutoStore & Biz supaya bisa diuji tanpa database.

import { DEFAULT_JOB } from "@/lib/media/schedule";
import { qaCfgOf } from "@/server/studio/cpr";
import { policyReady, type Policy, type PolicyKey } from "./policies";
import { COND_FIELDS, TEMPLATES, type AutoEvent, type GNode, type Graph, type TemplateKey } from "./types";

type Doc = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));
const obj = (v: unknown): Doc => (v && typeof v === "object" && !Array.isArray(v) ? (v as Doc) : {});

export type RunStatus = "running" | "waiting_for_human" | "completed" | "failed" | "needs_configuration" | "skipped";
export type Run = { id: string; workflowKey: string; version: number; eventId: string; entityId: string; status: RunStatus; cursor: string; waitKey: string | null; ctx: Doc; dryRun: boolean; error: string | null; correlationId: string };
export type StepRec = { runId: string; nodeId: string; status: "completed" | "needs_configuration" | "failed" | "waiting" | "skipped"; handle: string | null; result: Doc; at: Date };
export type Timer = { id?: string; key: string; kind: "reminder" | "performance"; entityId: string; dueAt: Date; payload: Doc; runId: string | null };
/** since = event sebelum waktu ini tidak memulai run (versi diterbitkan / worker dinyalakan): tumpukan event lama tidak membanjiri notifikasi. */
export type ActiveWf = { key: string; version: number; graph: Graph; since?: Date };
export type AuditIn = { actorType: "system" | "user"; actorId: string; action: string; resourceType: string; resourceId: string; outcome: string; correlationId: string; detail?: Doc };

export interface AutoStore {
  activeWorkflows(): Promise<ActiveWf[]>;
  versionGraph(key: string, version: number): Promise<Graph | null>;
  inboxTry(eventId: string, consumer: string): Promise<boolean>;
  createRun(r: Omit<Run, "id">): Promise<Run | null>; // null = run untuk event ini sudah ada
  saveRun(r: Run): Promise<void>;
  waitingRuns(waitKey: string): Promise<Run[]>;
  stepDone(runId: string, nodeId: string): Promise<StepRec | null>;
  addStep(st: StepRec): Promise<void>;
  upsertTimer(t: Timer): Promise<boolean>; // false = kunci sudah ada
  cancelTimers(prefix: string, keep: string[]): Promise<number>;
  claimDueTimers(now: Date, limit: number): Promise<Timer[]>; // pending → firing secara atomik
  finishTimer(id: string, status: "sent" | "suppressed" | "failed"): Promise<void>;
  deliveryTry(key: string): Promise<boolean>; // false = sudah pernah dikirim
  policy(key: PolicyKey): Promise<Policy>;
  audit(e: AuditIn): Promise<void>;
}
export interface Biz {
  getTask(id: string): Promise<Doc | null>;
  settings(): Promise<Doc>;
  assignIfEmpty(id: string, role: "producer" | "editor", code: string): Promise<boolean>;
  userIdsForCodes(codes: string[]): Promise<string[]>;
  staffUserIds(): Promise<string[]>;
  notify(userIds: string[], msg: { type: string; title: string; body: string; url: string; wa: boolean }): Promise<void>;
  hasSnapshot(taskId: string, cp: string): Promise<boolean>;
}
export type Deps = { store: AutoStore; biz: Biz; now: Date };

const IDX: Record<string, number> = { Terdata: 0, Rencana: 0, "Siap Produksi": 0, Diproduksi: 1, Editing: 2, QC: 3, Ready: 3, Terjadwal: 3, Tayang: 4 };
type Res = { handle?: string | null; wait?: string; stop?: RunStatus; result?: Doc };

const next = (g: Graph, id: string, handle?: string | null) => g.edges.find((e) => e.source === id && (handle == null || e.sourceHandle === handle))?.target ?? null;
const cardLink = (id: string) => "/studio/?p=pipeline&card=" + encodeURIComponent(id);

async function pol(d: Deps, key: PolicyKey): Promise<Policy | null> {
  const p = await d.store.policy(key);
  return policyReady(p) ? p : null;
}
async function recipients(d: Deps, to: string, task: Doc): Promise<string[]> {
  if (to === "reviewers") return d.biz.staffUserIds();
  return d.biz.userIdsForCodes([s(task.producer), s(task.editor)].filter(Boolean));
}

async function exec(n: GNode, g: Graph, run: Run, d: Deps): Promise<Res> {
  const task = await d.biz.getTask(run.entityId);
  if (!task) return { stop: "skipped", result: { reason: "kartu tidak ditemukan" } };
  const dry = run.dryRun;
  switch (n.type) {
    case "trigger":
      return { handle: null };
    case "end":
      return { stop: "completed" };
    case "condition": {
      const f = s(n.data.field);
      const brief = obj(obj(task.brief).data);
      const val =
        f === "type" ? s(task.type) : f === "status" ? s(task.status) : f === "briefReq" ? String(task.briefReq === true)
        : f === "primary" ? s(brief.primary) : f === "qaResult" ? s(run.ctx.result || obj(task.qa).st)
        : f === "hasProducer" ? String(!!s(task.producer)) : f === "hasEditor" ? String(!!s(task.editor)) : "";
      if (!COND_FIELDS[f]) return { stop: "failed", result: { error: "field tidak dikenal" } };
      const vals = Array.isArray(n.data.value) ? n.data.value.map(String) : [s(n.data.value)];
      const ok = n.data.op === "neq" ? !vals.includes(val) : vals.includes(val);
      return { handle: ok ? "true" : "false", result: { field: f, value: val } };
    }
    case "assign_owner": {
      const p = await pol(d, "assignment.mapping");
      if (!p) return { stop: "needs_configuration", result: { policy: "assignment.mapping" } };
      const role = n.data.role === "editor" ? "editor" : "producer";
      if (s(task[role])) return { handle: null, result: { unchanged: true, owner: s(task[role]) } };
      const set = await d.biz.settings();
      const jd = obj(obj(set.jobdesk)[s(task.type)]);
      const def = DEFAULT_JOB[s(task.type)];
      const list = (role === "producer" ? (jd.prod ?? def?.prod) : (jd.edit ?? def?.edit)) as string[] | undefined;
      const code = Array.isArray(list) ? s(list[0]) : "";
      if (!code) return { stop: "needs_configuration", result: { reason: "jobdesk jenis ini tidak punya PIC " + role } };
      if (dry) return { handle: null, result: { wouldAssign: code, role } };
      const done = await d.biz.assignIfEmpty(run.entityId, role, code);
      await d.store.audit({ actorType: "system", actorId: "automation", action: "task.assigned", resourceType: "task", resourceId: run.entityId, outcome: done ? "assigned" : "already_set", correlationId: run.correlationId, detail: { role, code } });
      return { handle: null, result: { assigned: done ? code : null, role } };
    }
    case "notify": {
      const p = await pol(d, "notify.channel");
      if (!p) return { stop: "needs_configuration", result: { policy: "notify.channel" } };
      const ids = await recipients(d, s(n.data.to), task);
      const tpl = s(n.data.template) as TemplateKey;
      if (dry) return { handle: null, result: { wouldNotify: ids.length, template: tpl } };
      const fresh: string[] = [];
      for (const u of ids) if (await d.store.deliveryTry(run.id + ":" + n.id + ":" + u)) fresh.push(u);
      if (fresh.length) await d.biz.notify(fresh, { type: "studio_auto", title: TEMPLATES[tpl], body: s(task.title), url: cardLink(run.entityId), wa: p.config.channel === "app_wa" });
      return { handle: null, result: { sent: fresh.length, skippedDuplicates: ids.length - fresh.length } };
    }
    case "request_qa": {
      const cfg = qaCfgOf((await d.biz.settings()).qaCfg);
      const inds = cfg.types[s(task.type)] ?? [];
      return { handle: null, result: { checklistVersion: cfg.v, indicators: inds.map((i) => i.k), critical: inds.filter((i) => i.c).map((i) => i.k) } };
    }
    case "human_approval": {
      const qa = obj(task.qa);
      const key = "qa:" + run.entityId + ":v" + s(qa.ver);
      if (run.ctx.result && run.waitKey) {
        // dilanjutkan oleh keputusan orang (qa.completed). Persetujuan TIDAK pernah otomatis.
        return { handle: run.ctx.result === "approved" ? "approved" : "revision", result: { decision: run.ctx.result, ver: run.ctx.ver } };
      }
      if (dry) return { handle: "approved", result: { wouldWaitFor: key } };
      return { wait: key, result: { waitingFor: "keputusan Creative Review oleh admin / Admin 2", key } };
    }
    case "wait": {
      const p = await pol(d, "reminder.schedule");
      if (!p) return { stop: "needs_configuration", result: { policy: "reminder.schedule" } };
      const dl = s(task.readyBy || task.due);
      const prefix = "rem:" + run.entityId + ":";
      if (!dl || (IDX[s(task.status)] ?? 0) >= 3) {
        if (!dry) await d.store.cancelTimers(prefix, []);
        return { handle: null, result: { scheduled: 0, reason: !dl ? "tanpa deadline" : "sudah Ready" } };
      }
      const at = deadlineMoment(dl, s(p.config.deadlineTime));
      const keys: Timer[] = (p.config.offsetsHours as number[]).map((h) => ({ key: prefix + dl + ":" + h, kind: "reminder" as const, entityId: run.entityId, dueAt: new Date(at.getTime() - h * 3600_000), payload: { deadline: dl, hours: h }, runId: run.id })).filter((t) => t.dueAt > d.now);
      if (dry) return { handle: null, result: { wouldSchedule: keys.map((k) => k.dueAt.toISOString()) } };
      const cancelled = await d.store.cancelTimers(prefix, keys.map((k) => k.key));
      let made = 0;
      for (const t of keys) if (await d.store.upsertTimer(t)) made++;
      return { handle: null, result: { scheduled: made, cancelledOld: cancelled } };
    }
    case "performance_eval": {
      const p = await pol(d, "performance.checkpoints");
      if (!p) return { stop: "needs_configuration", result: { policy: "performance.checkpoints" } };
      const postAt = s(task.postAt);
      if (!postAt) return { handle: null, result: { scheduled: 0, reason: "tanpa tanggal tayang" } };
      const T: Timer[] = (p.config.days as number[]).map((n2) => ({ key: "perf:" + run.entityId + ":" + postAt + ":D+" + n2, kind: "performance" as const, entityId: run.entityId, dueAt: deadlineMoment(addDays(postAt, n2), s(p.config.sendTime)), payload: { cp: "D+" + n2, postAt }, runId: run.id }));
      if (dry) return { handle: null, result: { wouldSchedule: T.map((t) => t.payload.cp) } };
      let made = 0;
      for (const t of T) if (await d.store.upsertTimer(t)) made++;
      return { handle: null, result: { scheduled: made, note: "hanya pengingat mencatat metrik; tidak ada data analitik otomatis" } };
    }
    case "attach_campaign":
      return { stop: "needs_configuration", result: { policy: "campaign.master", reason: "campaign master belum ada" } };
  }
}

/** Tanggal YYYY-MM-DD + jam HH:MM WIB → Date (UTC). */
export function deadlineMoment(day: string, hhmm: string): Date {
  const [h, m] = /^\d{2}:\d{2}$/.test(hhmm) ? hhmm.split(":").map(Number) : [0, 0];
  return new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), h - 7, m));
}
const addDays = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

/** Jalankan run dari cursor sampai selesai / menunggu / berhenti. */
export async function advance(run: Run, g: Graph, d: Deps): Promise<Run> {
  for (let guard = 0; guard < 60; guard++) {
    const n = g.nodes.find((x) => x.id === run.cursor);
    if (!n) { run.status = "failed"; run.error = "node tidak ditemukan: " + run.cursor; break; }
    const prev = await d.store.stepDone(run.id, n.id);
    let r: Res;
    if (prev && prev.status === "completed") r = { handle: prev.handle }; // replay: jangan ulang efek samping
    else {
      try {
        r = await exec(n, g, run, d);
      } catch (e) {
        r = { stop: "failed", result: { error: e instanceof Error ? e.message : String(e) } };
      }
      await d.store.addStep({ runId: run.id, nodeId: n.id, status: r.wait ? "waiting" : r.stop && r.stop !== "completed" ? (r.stop === "skipped" ? "skipped" : r.stop === "failed" ? "failed" : "needs_configuration") : "completed", handle: r.handle ?? null, result: r.result ?? {}, at: d.now });
    }
    if (r.wait) { run.status = "waiting_for_human"; run.waitKey = r.wait; break; }
    if (r.stop) { run.status = r.stop; if (r.stop === "failed") run.error = s(r.result?.error) || "gagal"; break; }
    const t = next(g, n.id, HANDLED.has(n.type) ? r.handle : null);
    if (!t) { run.status = "failed"; run.error = "tidak ada garis keluar dari " + n.id; break; }
    run.cursor = t;
    run.waitKey = null;
  }
  if (run.status === "running") { run.status = "failed"; run.error = "langkah terlalu banyak"; }
  await d.store.saveRun(run);
  await d.store.audit({ actorType: "system", actorId: "automation", action: "run." + run.status, resourceType: "task", resourceId: run.entityId, outcome: run.status, correlationId: run.correlationId, detail: { workflow: run.workflowKey, version: run.version, dryRun: run.dryRun } });
  return run;
}
const HANDLED = new Set(["condition", "human_approval"]);

/** Satu event: mulai run untuk setiap workflow terbit yang dipicu event ini, dan lanjutkan run yang menunggu keputusan. */
export async function processEvent(ev: AutoEvent, d: Deps): Promise<Run[]> {
  const out: Run[] = [];
  for (const wf of await d.store.activeWorkflows()) {
    const trig = wf.graph.nodes.find((n) => n.type === "trigger");
    if (!trig || trig.data.event !== ev.type) continue;
    if (wf.since && ev.occurredAt < wf.since) continue; // event lama (sebelum terbit / sebelum worker menyala): diabaikan
    if (!(await d.store.inboxTry(ev.id, wf.key + ":v" + wf.version))) continue; // event ganda
    const run = await d.store.createRun({ workflowKey: wf.key, version: wf.version, eventId: ev.id, entityId: ev.entityId, status: "running", cursor: trig.id, waitKey: null, ctx: { event: ev.type, ...ev.payload }, dryRun: false, error: null, correlationId: ev.correlationId });
    if (run) out.push(await advance(run, wf.graph, d));
  }
  if (ev.type === "qa.completed.v1") {
    const key = "qa:" + ev.entityId + ":v" + s(ev.payload.ver);
    for (const run of await d.store.waitingRuns(key)) {
      if (!(await d.store.inboxTry(ev.id, "resume:" + run.id))) continue;
      const g = await d.store.versionGraph(run.workflowKey, run.version); // run tetap memakai versi saat dimulai
      if (!g) continue;
      run.ctx = { ...run.ctx, result: s(ev.payload.result), ver: ev.payload.ver };
      run.status = "running";
      out.push(await advance(run, g, d));
    }
  }
  return out;
}

/** Timer jatuh tempo: baca ulang kartu sebelum mengirim; kirim sekali (kunci unik), atau batalkan bila sudah tidak relevan. */
export async function fireTimers(d: Deps): Promise<{ sent: number; suppressed: number }> {
  let sent = 0, suppressed = 0;
  for (const t of await d.store.claimDueTimers(d.now, 50)) {
    const task = await d.biz.getTask(t.entityId);
    let why = "";
    let to = "pic";
    let tpl: TemplateKey = "deadline_reminder";
    let waPerf = false; // pengingat metrik: WhatsApp bisa dinyalakan khusus (performance.checkpoints.wa), terpisah dari saluran umum
    if (!task) why = "kartu tidak ada";
    else if (t.kind === "reminder") {
      const p = await pol(d, "reminder.schedule");
      if (!p) why = "aturan pengingat tidak aktif";
      else if ((IDX[s(task.status)] ?? 0) >= 3) why = "sudah Ready";
      else if (s(task.readyBy || task.due) !== s(t.payload.deadline)) why = "deadline sudah berubah";
      to = s(p?.config.recipients) || "pic";
    } else {
      const p = await pol(d, "performance.checkpoints");
      tpl = "metrics_due";
      waPerf = p?.config.wa === true;
      if (!p) why = "aturan evaluasi tidak aktif";
      else if (!(Array.isArray(p.config.days) ? (p.config.days as number[]) : []).map((n) => "D+" + n).includes(s(t.payload.cp))) why = "checkpoint " + s(t.payload.cp) + " tidak dipakai lagi";
      else if (task.status !== "Tayang" || s(task.postAt) !== s(t.payload.postAt)) why = "tanggal tayang berubah";
      else if (await d.biz.hasSnapshot(t.entityId, s(t.payload.cp))) why = "metrik sudah dicatat";
      to = s(p?.config.recipients) || "pic";
    }
    const ch = await pol(d, "notify.channel");
    if (!why && !ch) why = "saluran notifikasi belum dikonfigurasi";
    if (why || !task) {
      suppressed++;
      await d.store.finishTimer(t.id!, "suppressed");
      await d.store.audit({ actorType: "system", actorId: "automation", action: "reminder.suppressed", resourceType: "task", resourceId: t.entityId, outcome: why, correlationId: t.key });
      continue;
    }
    const ids = await recipients(d, to, task);
    const fresh: string[] = [];
    for (const u of ids) if (await d.store.deliveryTry(t.key + ":" + u)) fresh.push(u);
    if (fresh.length) await d.biz.notify(fresh, { type: "studio_auto", title: TEMPLATES[tpl] + (t.kind === "performance" ? " (" + s(t.payload.cp) + ")" : ""), body: s(task.title), url: cardLink(t.entityId), wa: ch!.config.channel === "app_wa" || waPerf });
    await d.store.finishTimer(t.id!, "sent");
    await d.store.audit({ actorType: "system", actorId: "automation", action: "reminder.sent", resourceType: "task", resourceId: t.entityId, outcome: "sent:" + fresh.length, correlationId: t.key });
    sent++;
  }
  return { sent, suppressed };
}

/** Uji coba tanpa efek samping: jalankan graf untuk satu kartu, semua aksi hanya dilaporkan ("would ..."). */
export async function dryRun(g: Graph, entityId: string, event: AutoEvent["type"], d: Deps): Promise<{ status: RunStatus; steps: StepRec[] }> {
  const steps: StepRec[] = [];
  const mem: AutoStore = {
    ...d.store,
    stepDone: async () => null,
    addStep: async (x) => void steps.push(x),
    saveRun: async () => {},
    audit: async () => {},
    upsertTimer: async () => true,
    cancelTimers: async () => 0,
    deliveryTry: async () => true,
  };
  const trig = g.nodes.find((n) => n.type === "trigger");
  const run: Run = { id: "dry", workflowKey: "dry", version: 0, eventId: "dry", entityId, status: "running", cursor: trig?.id ?? "", waitKey: null, ctx: { event }, dryRun: true, error: null, correlationId: "dry" };
  const r = await advance(run, g, { ...d, store: mem });
  return { status: r.status, steps };
}
