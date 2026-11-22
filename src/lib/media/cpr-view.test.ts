import { test } from "node:test";
import assert from "node:assert/strict";
import { cprKpi, indexCprDocs, toCprRow } from "./cpr-view";

const T = "2026-11-22";
const task = (o: Record<string, unknown> = {}) => ({ id: "t1", title: "Wilson Clash", type: "vrv", status: "Ready", producer: "A", editor: "R", itemId: null, due: "2026-11-20", readyAt: "2026-11-19", postAt: null, extra: { cprId: "TRT-CPR-VRV-2611-0001", brief: { st: "approved", ok: { v: 1, data: { pillar: "Educate", primary: "ENT" } } }, qa: { sys: 2, st: "approved", appBy: "Aulia", appAt: 5, rev: { score: 86, by: "Aulia" } } }, createdAt: new Date("2026-11-05T03:00:00Z"), ...o });

test("koleksi cpr: snapshot, inquiry, order (Unknown tidak dihitung)", () => {
  const d = indexCprDocs([
    { path: "cpr/s_t1_7", data: { taskId: "t1", cp: "D+7", reach: 1200, saves: null, source: "IG" } },
    { path: "cpr/q_wa1", data: { taskId: "t1" } }, { path: "cpr/q_wa2", data: { taskId: "t1" } },
    { path: "cpr/o_1", data: { taskId: "t1", kind: "Direct", amount: 500000 } }, { path: "cpr/o_2", data: { taskId: "t1", kind: "Unknown", amount: 9 } },
    { path: "cpr/a_x", data: { insight: "x" } },
  ]);
  const r = toCprRow(task(), T, d, null)!;
  assert.equal(r.inquiries, 2);
  assert.equal(r.orders, 1);
  assert.equal(r.revenue, 500000);
  assert.equal(r.snaps[0].reach, 1200);
  assert.equal(r.snaps[0].saves, null); // N/A, bukan 0
});

test("baris registry: brief disetujui, skor review, bukan CPR / ditangguhkan disembunyikan", () => {
  const e = indexCprDocs([]);
  const r = toCprRow(task(), T, e, null)!;
  assert.equal(r.pillar, "Educate");
  assert.equal(r.reviewScore, 86);
  assert.equal(r.late, false);
  assert.equal(toCprRow(task({ type: "ktl" }), T, e, null), null);
  assert.equal(toCprRow(task({ extra: { suspendedAt: 1 } }), T, e, null), null);
  assert.equal(toCprRow(task({ status: "Editing", readyAt: null }), T, e, null)!.late, true);
  assert.equal(toCprRow(task({ extra: { qa: { st: "ok", by: "Zaki", at: 9 } } }), T, e, null)!.reviewSt, "approved"); // QA lama
});

test("KPI per bulan brief", () => {
  const e = indexCprDocs([]);
  const rows = [toCprRow(task(), T, e, null)!, toCprRow(task({ id: "t2", status: "Tayang", readyAt: "2026-11-25", extra: {} }), T, e, null)!, toCprRow(task({ id: "t3", createdAt: new Date("2026-10-30T03:00:00Z") }), T, e, null)!];
  const k = cprKpi(rows, "2026-11");
  assert.deepEqual([k.planned, k.briefApproved, k.reviewApproved, k.published, k.onTime, k.withDeadline], [2, 1, 1, 1, 1, 2]);
});
