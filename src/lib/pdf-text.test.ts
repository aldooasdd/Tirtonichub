import { test } from "node:test";
import assert from "node:assert/strict";
import { pageLines } from "./pdf-text";

const it = (str: string, x: number, y: number, width = str.length * 5) => ({ str, transform: [1, 0, 0, 1, x, y], width });

test("pageLines: urut atas-bawah, kiri-kanan, kolom dipisah spasi", () => {
  const out = pageLines([it("1,299,000.00", 300, 700), it("[4582] Break", 10, 700), it("Shot 5", 10, 688), it("Total", 10, 600)]);
  assert.equal(out, "[4582] Break   1,299,000.00\nShot 5\nTotal");
});
