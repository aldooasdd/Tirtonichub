import { strict as assert } from "node:assert";
import { reconcile } from "./accurate-match";

const app = [
  { id: "1", notaNo: "INV-001", dateKey: "2026-10-20", grandTotal: 254000, customer: "Samuel" },
  { id: "2", notaNo: "INV-002", dateKey: "2026-10-21", grandTotal: 100000, customer: "Budi" },
  { id: "3", notaNo: "INV-003", dateKey: "2026-10-22", grandTotal: 50000, customer: "Ana" },
];
const acc = [
  { notaNo: "inv-001", date: "2026-10-20", customer: "Samuel", total: 254000 }, // cocok (case/spasi beda)
  { notaNo: "INV-002", date: "2026-10-21", customer: "Budi", total: 999999 }, // selisih total
  { notaNo: "INV-999", date: "2026-10-22", customer: "X", total: 70000 }, // hanya Accurate
];

const r = reconcile(acc, app);
assert.equal(r.cocok.length, 1);
assert.equal(r.cocok[0].notaNo, "inv-001");
assert.deepEqual(r.marks, [{ id: "1", ref: "inv-001" }]);
assert.equal(r.selisih.length, 1);
assert.equal(r.selisih[0].appTotal, 100000);
assert.equal(r.hanyaAccurate.length, 1);
assert.equal(r.hanyaAccurate[0].notaNo, "INV-999");
// INV-003 ada di rekap, dalam rentang 20..22, tak ada di Accurate → hanyaRekap
assert.equal(r.hanyaRekap.length, 1);
assert.equal(r.hanyaRekap[0].notaNo, "INV-003");

console.log("accurate-match ok");
