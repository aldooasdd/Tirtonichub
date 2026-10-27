import { strict as assert } from "node:assert";
import { stripSize, groupKey } from "./raw-group";

// stripSize buang ukuran dari nama
assert.equal(
  stripSize("ASICS GEL-RESOLUTION X WHITE/PEACH GREEN /EUR 39.5", "EUR 39.5"),
  "ASICS GEL-RESOLUTION X WHITE/PEACH GREEN",
);
assert.equal(stripSize("Nama tanpa ukuran", null), "Nama tanpa ukuran");
assert.equal(stripSize("Kaos Polos EUR", "42"), "Kaos Polos"); // EUR yatim kebuang

// groupKey: ukuran beda, model+warna sama → kunci sama
const a = { brand: "ASICS", color: "WHITE/PEACH GREEN", name: "ASICS GEL-RESOLUTION X WHITE/PEACH GREEN" };
const b = { brand: "asics", color: "white/peach green", name: "ASICS GEL-RESOLUTION X WHITE/PEACH GREEN" };
assert.equal(groupKey(a), groupKey(b));
// model beda → kunci beda
assert.notEqual(groupKey(a), groupKey({ ...a, name: "ASICS GEL-RESOLUTION X GS WHITE/MIDNIGHT" }));

console.log("raw-group ok");
