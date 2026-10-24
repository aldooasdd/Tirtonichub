import { test } from "node:test";
import assert from "node:assert";
import { makeScheduler, addWork, isOff, toT, TYPES, type Ctx } from "./schedule";

const emptyCtx = (): Ctx => ({ items: [], tasks: [], settings: { idccDay: 3 } });

test("addWork melewati Kamis (seluruh tim libur)", () => {
  // 2026-01-07 = Rabu; +1 hari kerja harus lompati Kamis (08) → Jumat 2026-01-09
  assert.equal(addWork("2026-01-07", 1), "2026-01-09");
  assert.ok(isOff(toT("2026-01-08"))); // Kamis
  assert.ok(!isOff(toT("2026-01-09"))); // Jumat
});

test("planBatch satu barang JP → 4 konten (ktl,igf,vpr,vrv) terjadwal lengkap", () => {
  const sch = makeScheduler(emptyCtx());
  const it = sch.planBatch([{ id: "x", cat: "sepatu", tier: "JP", qty: 20, arrived: "2026-01-05" }], "2026-01-05")[0];
  const types = it.tasks.map((t) => t.type);
  assert.deepEqual(types, ["ktl", "igf", "vpr", "vrv"]);
  for (const t of it.tasks) {
    assert.ok(t.shootPlan && t.editPlan, `${t.type} punya shoot/edit`);
    assert.ok(!isOff(toT(t.shootPlan)), `${t.type} syuting bukan hari Kamis`);
    assert.ok(toT(t.editPlan) >= toT(t.shootPlan), `${t.type} edit >= syuting`);
    if (t.type !== "ktl") assert.ok(t.postAt, `${t.type} punya tanggal tayang`);
    assert.ok(toT(t.editPlan) <= toT(t.due), `${t.type} edit <= batas siap`);
  }
  // katalog target hari itu juga
  assert.equal(TYPES.ktl.target, 0);
});

test("computeBalance memindah syuting yang tanggalnya lewat ke hari kerja >= start", () => {
  const ctx = emptyCtx();
  ctx.tasks = [
    { id: "t1", type: "igf", status: "Terdata", producer: "R", talent: "S", editor: "R", shootPlan: "2026-01-05", editPlan: "2026-01-05", postAt: "2026-01-07", cat: "sepatu", source: "baru" },
  ];
  const sch = makeScheduler(ctx);
  const changes = sch.computeBalance("2026-02-02", false); // start jauh setelah shootPlan
  const c = changes.find((c) => c.t.id === "t1");
  assert.ok(c, "ada perubahan untuk t1");
  assert.ok(c!.patch.shootPlan && c!.patch.shootPlan >= "2026-02-02", "shoot digeser ke >= start");
  assert.ok(!isOff(toT(c!.patch.shootPlan as string)), "shoot baru bukan Kamis");
});
