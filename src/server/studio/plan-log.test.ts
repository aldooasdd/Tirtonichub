import { test } from "node:test";
import assert from "node:assert/strict";
import { nextPlanLog, PLAN_LOG_MAX } from "./plan-log";

const AT = 1_762_650_000_000;

test("kartu baru: tanggal yang terisi dicatat sebagai rencana awal", () => {
  const log = nextPlanLog(undefined, null, { shootPlan: "2026-11-11", editPlan: "" }, "Zaki", "studio", AT);
  assert.deepEqual(log, [{ at: AT, by: "Zaki", f: "shootPlan", from: "", to: "2026-11-11", src: "studio" }]);
});

test("tanggal berubah: dicatat dari → ke, catatan lama tetap", () => {
  const prev = [{ at: 1, by: "Zaki", f: "shootPlan", from: "", to: "2026-11-11", src: "studio" }];
  const log = nextPlanLog(prev, { shootPlan: "2026-11-11", editPlan: "2026-11-12" }, { shootPlan: "2026-11-13", editPlan: "2026-11-12" }, "Rayhan", "dasbor", AT);
  assert.equal(log!.length, 2);
  assert.deepEqual(log![1], { at: AT, by: "Rayhan", f: "shootPlan", from: "2026-11-11", to: "2026-11-13", src: "dasbor" });
});

test("tidak berubah: tidak ada catatan baru", () => {
  assert.equal(nextPlanLog(undefined, { shootPlan: "2026-11-11" }, { shootPlan: "2026-11-11", note: "x" }, "Zaki", "studio", AT), undefined);
});

test("null dan '' dianggap sama (kosong)", () => {
  assert.equal(nextPlanLog(undefined, { shootPlan: null, editPlan: null }, { shootPlan: "", editPlan: undefined }, "Zaki", "studio", AT), undefined);
});

test("isi sampah di catatan lama dibuang, panjang dibatasi", () => {
  const junk = [{ f: "postAt" }, "x", null, ...Array.from({ length: PLAN_LOG_MAX + 5 }, (_, i) => ({ at: i, by: "Z", f: "editPlan", from: "", to: "", src: "studio" }))];
  const log = nextPlanLog(junk, { shootPlan: "2026-11-11" }, { shootPlan: "2026-11-12" }, "Zaki", "studio", AT)!;
  assert.equal(log.length, PLAN_LOG_MAX);
  assert.equal(log.at(-1)!.to, "2026-11-12");
  assert.ok(log.every((e) => e.f === "shootPlan" || e.f === "editPlan"));
});
