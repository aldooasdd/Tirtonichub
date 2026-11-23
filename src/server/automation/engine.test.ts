import { test } from "node:test";
import assert from "node:assert/strict";
import { dryRun, fireTimers, processEvent, type Deps } from "./engine";
import { MemDb, memBiz, memStore } from "./mem-store";
import { TEMPLATES_WF } from "./templates";
import { taskEvents } from "./events";
import type { AutoEvent, EventType } from "./types";

const NOW = new Date("2026-11-21T03:00:00Z"); // 10.00 WIB
const wf = (k: string) => TEMPLATES_WF.find((w) => w.key === k)!.graph;
function setup() {
  const db = new MemDb();
  const deps = (now = NOW): Deps => ({ store: memStore(db), biz: memBiz(db), now });
  return { db, deps };
}
let seq = 0;
const ev = (type: EventType, entityId: string, payload: Record<string, unknown> = {}, id = "e" + ++seq): AutoEvent => ({ id, type, entityType: "task", entityId, payload, correlationId: "c-" + id, occurredAt: NOW });
const active = (db: MemDb, ...keys: string[]) => keys.forEach((k) => db.policies.set(k as never, { key: k as never, status: "active", config: CFG[k], version: 1 }));
const CFG: Record<string, Record<string, unknown>> = {
  "assignment.mapping": { source: "jobdesk" },
  "notify.channel": { channel: "app" },
  "reminder.schedule": { deadlineTime: "15:00", offsetsHours: [24, 2], recipients: "pic" },
  "performance.checkpoints": { days: [1, 7], sendTime: "09:00", recipients: "pic" },
};

test("A: event ganda tidak membuat penugasan / notifikasi ganda", async () => {
  const { db, deps } = setup();
  db.publish("cpr-assignment", wf("cpr-assignment"));
  active(db, "assignment.mapping", "notify.channel");
  db.tasks.set("t1", { type: "vrv", title: "Review", producer: "", editor: "" });
  const e = ev("cpr.ready_for_assignment.v1", "t1");
  await processEvent(e, deps());
  await processEvent(e, deps()); // dikirim ulang
  assert.equal(db.assigned.length, 1);
  assert.equal(db.assigned[0].code, "A"); // jobdesk bawaan Video review: produksi Aulia
  assert.equal(db.sent.length, 1);
  assert.equal([...db.runs.values()][0].status, "completed");
});

test("A: tanpa aturan pemetaan PIC → Needs Configuration, tidak memilih orang", async () => {
  const { db, deps } = setup();
  db.publish("cpr-assignment", wf("cpr-assignment"));
  db.tasks.set("t1", { type: "igf", title: "Foto", producer: "" });
  const [run] = await processEvent(ev("cpr.ready_for_assignment.v1", "t1"), deps());
  assert.equal(run.status, "needs_configuration");
  assert.equal(db.assigned.length, 0);
  assert.equal(db.tasks.get("t1")!.producer, "");
});

test("B: review diajukan → menunggu keputusan orang (bukan Approved); lanjut setelah restart", async () => {
  const { db, deps } = setup();
  db.publish("qa-approval", wf("qa-approval"));
  active(db, "notify.channel");
  db.tasks.set("t2", { type: "igf", title: "Foto", producer: "R", editor: "R", qa: { sys: 2, st: "submitted", ver: 1 } });
  const [run] = await processEvent(ev("production.submitted_for_qa.v1", "t2", { ver: 1 }), deps());
  assert.equal(run.status, "waiting_for_human");
  assert.equal(db.sent.length, 1); // reviewer diberi tahu
  const qaStep = db.steps.find((s) => s.nodeId === "q")!;
  assert.deepEqual(qaStep.result.indicators, ["acc", "vis", "comp", "cap", "tech"]); // checklist Foto IG dari standar QA
  // "restart": deps baru, data sama di database
  const [res] = await processEvent(ev("qa.completed.v1", "t2", { ver: 1, result: "revision" }), deps());
  assert.equal(res.status, "completed");
  assert.equal(db.sent.at(-1)!.title, "Creative Review: perlu revisi");
  // keputusan kedua untuk versi yang sama tidak melanjutkan run lagi
  assert.equal((await processEvent(ev("qa.completed.v1", "t2", { ver: 1, result: "approved" }), deps())).length, 0);
});

test("C: pengingat dijadwalkan dari aturan; deadline berubah membatalkan yang lama; Ready tidak diingatkan", async () => {
  const { db, deps } = setup();
  db.publish("deadline-reminder", wf("deadline-reminder"));
  active(db, "reminder.schedule", "notify.channel");
  db.tasks.set("t3", { type: "vpr", title: "Video", producer: "Z", editor: "Z", status: "Editing", readyBy: "2026-11-25" });
  await processEvent(ev("task.deadline_changed.v1", "t3"), deps());
  assert.equal(db.timers.filter((t) => t.status === "pending").length, 2);
  db.tasks.get("t3")!.readyBy = "2026-11-27";
  await processEvent(ev("task.deadline_changed.v1", "t3"), deps());
  assert.equal(db.timers.filter((t) => t.status === "cancelled").length, 2);
  assert.equal(db.timers.filter((t) => t.status === "pending").length, 2);
  // pengingat lama yang sempat diambil tetap tidak terkirim karena deadline berubah
  db.timers.push({ id: "old", key: "rem:t3:2026-11-25:99", kind: "reminder", entityId: "t3", dueAt: NOW, payload: { deadline: "2026-11-25" }, runId: null, status: "pending" });
  db.tasks.get("t3")!.status = "Editing";
  const r1 = await fireTimers(deps(new Date("2026-11-26T08:30:00Z")));
  assert.equal(r1.sent, 1); // 24 jam sebelum 27 Nov 15.00 WIB
  assert.equal(r1.suppressed, 1); // yang lama
  db.tasks.get("t3")!.status = "Ready";
  const r2 = await fireTimers(deps(new Date("2026-11-27T07:00:00Z")));
  assert.equal(r2.sent, 0);
  assert.equal(r2.suppressed, 1);
});

test("C: tanpa jadwal pengingat yang disetujui → Needs Configuration, tidak ada timer", async () => {
  const { db, deps } = setup();
  db.publish("deadline-reminder", wf("deadline-reminder"));
  db.tasks.set("t3", { type: "vpr", status: "Editing", readyBy: "2026-11-25" });
  const [run] = await processEvent(ev("task.deadline_changed.v1", "t3"), deps());
  assert.equal(run.status, "needs_configuration");
  assert.equal(db.timers.length, 0);
});

test("D: campaign tidak pernah diaktifkan tanpa campaign master", async () => {
  const { db, deps } = setup();
  db.publish("campaign", wf("campaign"));
  db.tasks.set("t4", { type: "evt", campaignId: "CMP-PYD-2611" });
  const [run] = await processEvent(ev("campaign.content_linked.v1", "t4"), deps());
  assert.equal(run.status, "needs_configuration");
});

test("E: hanya pengingat mencatat metrik; tidak dikirim bila metrik sudah dicatat", async () => {
  const { db, deps } = setup();
  db.publish("performance", wf("performance"));
  active(db, "performance.checkpoints", "notify.channel");
  db.tasks.set("t5", { type: "igf", title: "Foto", producer: "R", status: "Tayang", postAt: "2026-11-21" });
  await processEvent(ev("content.published.v1", "t5"), deps());
  assert.equal(db.timers.length, 2);
  db.snapshots.add("t5:D+1");
  const r = await fireTimers(deps(new Date("2026-11-22T03:00:00Z")));
  assert.equal(r.sent, 0);
  assert.equal(r.suppressed, 1);
});

test("versi terbit dipakai run yang sedang berjalan; draf baru tidak mengubahnya", async () => {
  const { db, deps } = setup();
  db.publish("qa-approval", wf("qa-approval"));
  active(db, "notify.channel");
  db.tasks.set("t6", { type: "vrv", title: "R", producer: "R", qa: { sys: 2, st: "submitted", ver: 2 } });
  const [run] = await processEvent(ev("production.submitted_for_qa.v1", "t6", { ver: 2 }), deps());
  assert.equal(run.version, 1);
  const g2 = structuredClone(wf("qa-approval"));
  g2.nodes.find((n) => n.id === "rv")!.data = { to: "reviewers", template: "review_revision" };
  db.publish("qa-approval", g2); // versi 2 terbit
  const [res] = await processEvent(ev("qa.completed.v1", "t6", { ver: 2, result: "revision" }), deps());
  assert.equal(res.version, 1);
  assert.deepEqual(db.sent.at(-1)!.userIds, ["u-R"]); // perilaku versi 1 (ke kreator)
});

test("uji coba (dry run) tanpa efek samping", async () => {
  const { db, deps } = setup();
  active(db, "assignment.mapping", "notify.channel");
  db.tasks.set("t7", { type: "vpr", title: "V", producer: "" });
  const r = await dryRun(wf("cpr-assignment"), "t7", "cpr.ready_for_assignment.v1", deps());
  assert.equal(r.status, "completed");
  assert.equal(db.assigned.length, 0);
  assert.equal(db.sent.length, 0);
  assert.equal(db.runs.size, 0);
  assert.ok(r.steps.some((s) => s.result.wouldAssign === "R"));
});

test("event diturunkan dari perubahan kartu", () => {
  const b = { type: "vrv", status: "Terdata", brief: {} };
  const a = { ...b, brief: { ok: { v: 1, at: 5 } } };
  assert.deepEqual(taskEvents("x", b, a).map((e) => e.type), ["cpr.ready_for_assignment.v1"]);
  assert.deepEqual(taskEvents("x", { ...b, qa: { sys: 2, st: "none", log: [] } }, { ...b, qa: { sys: 2, st: "submitted", ver: 1, log: [{ act: "submit" }] } }).map((e) => e.type), ["production.submitted_for_qa.v1"]);
  assert.deepEqual(taskEvents("x", { ...b, status: "Ready" }, { ...b, status: "Tayang", postAt: "2026-11-21" }).map((e) => e.type), ["task.deadline_changed.v1", "content.published.v1"]);
  assert.deepEqual(taskEvents("x", { type: "ktl" }, { type: "ktl", status: "Tayang" }), []); // bukan jenis CPR
});

test("event lama (sebelum terbit / worker menyala) tidak memulai run & tidak mengirim notifikasi", async () => {
  const { db, deps } = setup();
  db.publish("qa-approval", wf("qa-approval"), new Date("2026-11-22T00:00:00Z"));
  active(db, "notify.channel");
  db.tasks.set("t9", { type: "vrv", title: "Lama", producer: "R", editor: "R", qa: { ver: 1 } });
  const old = { ...ev("production.submitted_for_qa.v1", "t9", { ver: 1 }), occurredAt: new Date("2026-11-21T05:00:00Z") };
  assert.equal((await processEvent(old, deps())).length, 0);
  assert.equal(db.sent.length, 0);
  const baru = { ...ev("production.submitted_for_qa.v1", "t9", { ver: 1 }), occurredAt: new Date("2026-11-22T05:00:00Z") };
  assert.equal((await processEvent(baru, deps())).length, 1);
  assert.equal(db.sent.length, 1); // reviewer diberi tahu untuk pengajuan baru saja
});

test("E: WhatsApp khusus pengingat metrik (wa:true) walau saluran umum aplikasi saja", async () => {
  const { db, deps } = setup();
  db.publish("performance", wf("performance"));
  active(db, "notify.channel");
  db.policies.set("performance.checkpoints", { key: "performance.checkpoints", status: "active", config: { days: [7], sendTime: "09:00", recipients: "pic", wa: true }, version: 1 });
  db.tasks.set("t6", { type: "vrv", title: "Review", producer: "R", status: "Tayang", postAt: "2026-11-21" });
  await processEvent(ev("content.published.v1", "t6"), deps());
  assert.equal(db.timers.length, 1); // D+7 saja
  const r = await fireTimers(deps(new Date("2026-11-28T03:00:00Z")));
  assert.equal(r.sent, 1);
  assert.equal(db.sent.at(-1)?.wa, true);
  assert.match(String(db.sent.at(-1)?.title), /D\+7/);
});

test("E: pengingat checkpoint yang sudah tidak dipakai (mis. D+1 setelah diganti D+7 saja) dibatalkan", async () => {
  const { db, deps } = setup();
  db.publish("performance", wf("performance"));
  active(db, "notify.channel");
  db.policies.set("performance.checkpoints", { key: "performance.checkpoints", status: "active", config: { days: [1, 7], sendTime: "09:00", recipients: "pic" }, version: 1 });
  db.tasks.set("t7", { type: "igf", title: "Foto", producer: "R", status: "Tayang", postAt: "2026-11-21" });
  await processEvent(ev("content.published.v1", "t7"), deps());
  assert.equal(db.timers.length, 2);
  db.policies.set("performance.checkpoints", { key: "performance.checkpoints", status: "active", config: { days: [7], sendTime: "09:00", recipients: "pic" }, version: 2 });
  const r = await fireTimers(deps(new Date("2026-11-22T03:00:00Z"))); // D+1 jatuh tempo
  assert.equal(r.sent, 0);
  assert.equal(r.suppressed, 1);
});
