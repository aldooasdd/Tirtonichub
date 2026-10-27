import { strict as assert } from "node:assert";
import { defaultShift } from "./shift-default";

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
// Nama tak dikenal → kosong.
assert.equal(defaultShift("Orang Asing", 1), "");

console.log("shift-default ok");
