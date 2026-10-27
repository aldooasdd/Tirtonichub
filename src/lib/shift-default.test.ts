import { strict as assert } from "node:assert";
import { defaultShift, hasShiftRow } from "./shift-default";

// Beberapa sel kunci dari PDF.
assert.equal(defaultShift("Kiki Admin", 1), "P");
assert.equal(defaultShift("Kiki", 13), "WFH");
assert.equal(defaultShift("Kiki", 24), "CUTI");
assert.equal(defaultShift("Kiki", 31), "CUTI");
assert.equal(defaultShift("Ghifari Crew Store", 31), "IZIN");
assert.equal(defaultShift("Lala", 3), "SAKIT");
assert.equal(defaultShift("Irfan S Head Store", 17), "CUTI");
assert.equal(defaultShift("A Taufiq", 1), "P");
// Denta baru masuk → sebagian bulan kosong.
assert.equal(defaultShift("Denta", 3), "CUTI");
assert.equal(defaultShift("Denta", 11), "");
// Alias: nama DB beda dgn PDF.
assert.equal(defaultShift("Aldi", 1), defaultShift("Aldy", 1));
assert.equal(defaultShift("Indy", 1), defaultShift("Siti Indira", 1));
assert.equal(defaultShift("Irfan", 17), defaultShift("Irfan S", 17));
assert.equal(defaultShift("Jose", 1), defaultShift("Josephira", 1));
assert.equal(defaultShift("Mawa", 10), defaultShift("Erina", 10));
// Nama tak dikenal → kosong.
assert.equal(defaultShift("Orang Asing", 1), "");
// hasShiftRow: Aldo (Sales) tak ada di PDF.
assert.equal(hasShiftRow("Aldo"), false);
assert.equal(hasShiftRow("Mawa"), true);

console.log("shift-default ok");
