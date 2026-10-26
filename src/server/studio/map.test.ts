import { test } from "node:test";
import assert from "node:assert/strict";
import { itemFromDoc, itemToDoc, taskFromDoc, taskToDoc, memberFromDoc, memberToDoc, NO_CODE } from "./map";

test("barang: kolom + extra bolak-balik tanpa kehilangan isian", () => {
  const doc = { name: "ASICS GEL", color: "white/pitch", cat: "sepatu", gender: "men", qty: 4, arrived: "2026-10-25", tier: "EX", seasonal: false, old: false, thumb: "data:x", arrivedAfter15: true, hot: true, desc: "kain" };
  const row = itemFromDoc(doc);
  assert.equal(row.arrived.toISOString().slice(0, 10), "2026-10-25");
  assert.deepEqual(row.extra, { arrivedAfter15: true, hot: true, desc: "kain" });
  const back = itemToDoc({ ...row, extra: row.extra, createdAt: new Date(5), updatedAt: new Date(6) } as never);
  for (const k of Object.keys(doc)) assert.deepEqual(back[k], (doc as Record<string, unknown>)[k], k);
});

test("tugas: readyBy, metaAt, riwayat, isian tambahan", () => {
  const doc = { itemId: "i1", type: "igf", title: "x", status: "Ready", readyBy: "2026-10-27", metaAt: 1792000000000, history: [{ to: "Ready" }], prio: 2, updatedBy: "Zaki", postAt: "", checked: true };
  const { row, itemId } = taskFromDoc(doc);
  assert.equal(itemId, "i1");
  assert.equal(row.readyBy, "2026-10-27");
  assert.deepEqual(row.extra, { prio: 2, updatedBy: "Zaki" });
  const back = taskToDoc({ ...(row as Record<string, unknown>), itemId, extra: row.extra, createdAt: new Date(1), updatedAt: new Date(2) } as never);
  assert.equal(back.metaAt, 1792000000000);
  assert.equal(back.postAt, "");
  assert.equal(back.prio, 2);
  assert.deepEqual(back.history, [{ to: "Ready" }]);
});

test("anggota: peran & kode, admin tanpa kode", () => {
  const r = memberFromDoc({ role: "admin2", code: "A", avColor: "pink" }, "u1");
  assert.equal(r.role, "ADMIN2");
  assert.equal(memberFromDoc({ role: "admin", code: "" }, "u9").code, NO_CODE("u9"));
  const d = memberToDoc({ email: "a@x", fullName: "Aulia P", nickname: "Aulia", createdAt: new Date(1), boss: false, m: { code: NO_CODE("u9"), role: "ADMIN", idcc: true, phone: null, avColor: "lime", avAnimal: null, extra: null, updatedAt: new Date(2) } });
  assert.equal(d.code, "");
  assert.equal(d.role, "admin");
  assert.equal(d.name, "Aulia");
});
