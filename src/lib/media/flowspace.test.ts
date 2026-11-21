import { test } from "node:test";
import assert from "node:assert/strict";
import { applyFilter, boardColumns, FS_EMPTY, toFsTask, viewWhy } from "./flowspace";

const T = "2026-11-21";
const row = (o: Record<string, unknown> = {}) => ({ id: "1", title: "Wilson Clash", type: "vrv", cat: "raket", status: "Editing", itemId: null, producer: "A", editor: "R", talent: null, script: null, shootPlan: null, editPlan: null, postAt: null, postTime: null, due: "2026-11-20", readyAt: null, metaAt: null, driveUrl: null, note: null, history: [], extra: { cprId: "TRT-CPR-VRV-2611-0001", brief: { st: "approved", ok: { v: 1 } }, qa: { sys: 2, st: "submitted" } }, createdAt: new Date(), ...o });
const N = { A: "Aulia", R: "Rayhan", Z: "Zaki" };

test("baris → kartu: status lama dipetakan, terlambat, brief & review, ditangguhkan/digabung disembunyikan", () => {
  const t = toFsTask(row(), T, null)!;
  assert.equal(t.late, true);
  assert.equal(t.brief, "approved");
  assert.equal(t.review, "submitted");
  assert.equal(toFsTask(row({ status: "QC" }), T, null)!.status, "Ready");
  assert.equal(toFsTask(row({ extra: { suspendedAt: 1 } }), T, null), null);
  assert.equal(toFsTask(row({ extra: { mergedInto: "x" } }), T, null), null);
  assert.equal(toFsTask(row({ extra: { readyBy: "2026-11-30" } }), T, null)!.late, false); // readyBy menggantikan due
});

test("filter: jenis, orang, terlambat, pencarian nama PIC & Content ID; Tayang lama disembunyikan", () => {
  const ts = [toFsTask(row(), T, null)!, toFsTask(row({ id: "2", type: "igf", producer: "R", editor: "R", due: null, title: "Asics" }), T, null)!, toFsTask(row({ id: "3", status: "Tayang", postAt: "2026-10-01" }), T, null)!];
  assert.equal(applyFilter(ts, FS_EMPTY, N, T).length, 2);
  assert.equal(applyFilter(ts, { ...FS_EMPTY, showTayang: true }, N, T).length, 3);
  assert.deepEqual(applyFilter(ts, { ...FS_EMPTY, types: ["igf"] }, N, T).map((t) => t.id), ["2"]);
  assert.deepEqual(applyFilter(ts, { ...FS_EMPTY, people: ["A"] }, N, T).map((t) => t.id), ["1"]);
  assert.deepEqual(applyFilter(ts, { ...FS_EMPTY, lateOnly: true }, N, T).map((t) => t.id), ["1"]);
  assert.deepEqual(applyFilter(ts, { ...FS_EMPTY, q: "aulia vrv-2611" }, N, T).map((t) => t.id), ["1"]);
});

test("papan: kolom tahap resmi, terlambat di atas", () => {
  const ts = [toFsTask(row({ id: "a", due: "2026-12-01" }), T, null)!, toFsTask(row({ id: "b" }), T, null)!];
  const ed = boardColumns(ts).find((c) => c.stage === "Editing")!;
  assert.deepEqual(ed.tasks.map((t) => t.id), ["b", "a"]);
  assert.deepEqual(boardColumns([]).map((c) => c.stage), ["Terdata", "Diproduksi", "Editing", "Ready", "Tayang"]);
});

test("tampilan tersimpan divalidasi", () => {
  const ok = { id: "v1", name: "Review saya", view: "table", filter: FS_EMPTY, sort: [], hidden: [] };
  assert.equal(viewWhy(ok), null);
  assert.notEqual(viewWhy({ ...ok, name: "" }), null);
  assert.notEqual(viewWhy({ ...ok, view: "x" }), null);
  assert.notEqual(viewWhy({ ...ok, filter: { ...FS_EMPTY, types: "igf" } }), null);
});
