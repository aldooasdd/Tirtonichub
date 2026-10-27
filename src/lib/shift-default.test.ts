import { strict as assert } from "node:assert";
import { defaultShift, hasShiftRow } from "./shift-default";

// Sel kunci dari PDF NOV.
assert.equal(defaultShift("Delfia Admin", 1), "S");
assert.equal(defaultShift("Wimas", 3), "WFH");
assert.equal(defaultShift("Dea", 2), "OH");
assert.equal(defaultShift("Jose", 2), "O");
assert.equal(defaultShift("Aldi", 1), "P");
assert.equal(defaultShift("Indy", 6), "O");
assert.equal(defaultShift("A Taufiq", 6), "O");
assert.equal(defaultShift("Nur Taufiq", 1), "P");

// Nama tak dikenal → kosong.
assert.equal(defaultShift("Orang Asing", 1), "");
assert.equal(hasShiftRow("Aldo"), false);
assert.equal(hasShiftRow("Junita"), true);

// Semua baris 30 token: tgl 30 terisi, tgl 31 kosong.
for (const name of ["Delfia", "Wimas", "Yopi", "Aldi", "Indy", "Edo", "Junita", "Dea", "Andhin", "Lala", "Mutia", "Ghifari", "Mawa", "Afi", "Jose", "Nur Taufiq", "Rahma", "A Taufiq", "Irfan"]) {
  assert.notEqual(defaultShift(name, 30), "", `${name} tgl 30 harus terisi (30 token)`);
  assert.equal(defaultShift(name, 31), "", `${name} tgl 31 harus kosong`);
}

console.log("shift-default ok");
