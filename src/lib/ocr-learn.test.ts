import { test } from "node:test";
import assert from "node:assert/strict";
import { learnedPrompt, ocrRow, ocrRows } from "./ocr-learn";

test("ocrRows urutan diabaikan, angka 2 desimal", () => {
  const a = ocrRows([ocrRow("B", 16, 108109.375, 1729750), ocrRow("A", 1, 10, 10)]);
  const b = ocrRows([ocrRow("A", 1, 10, 10), ocrRow(" B ", 16, 108109.38, 1729750)]);
  assert.equal(a, b);
  assert.equal(learnedPrompt([]), "");
  assert.match(learnedPrompt([{ aiRows: "x", finalRows: "y" }]), /AI baca \(SALAH\):\nx\n--- Finance simpan \(BENAR\):\ny/);
});
