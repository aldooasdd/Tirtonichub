import { test } from "node:test";
import assert from "node:assert/strict";
import { withKey } from "./lock";
import { critChecks, nextQa, QA_DEFAULT, type Qa } from "./cpr";

test("dua keputusan Creative Review bersamaan: hanya satu yang tercatat", async () => {
  const task = { type: "igf", cprId: "TRT-CPR-FIP-2611-0001", status: "Ready", producer: "R", editor: "R", driveUrl: "x" };
  const rayhan = { name: "Rayhan", code: "R", full: false, staff: false };
  let saved: unknown = nextQa(undefined, { act: "submit" }, task, rayhan, QA_DEFAULT, 1);
  const inds = QA_DEFAULT.types.igf, checks = critChecks(inds, QA_DEFAULT.checks);
  const decide = (who: { name: string; code: string; full: boolean; staff: boolean }, decision: string) =>
    withKey("tasks/t1", async () => {
      const before = saved; // baca
      await new Promise((r) => setTimeout(r, 5)); // jeda seperti akses database
      const q = nextQa(before, { act: "review", decision, scores: Object.fromEntries(inds.map((i) => [i.k, 5])), checks: Object.fromEntries(checks.map((c) => [c.k, true])), note: "catatan revisi" }, task, who, QA_DEFAULT, 2);
      if (typeof q === "string") return q;
      saved = q; // tulis
      return "ok";
    });
  const r = await Promise.all([decide({ name: "Zaki", code: "Z", full: true, staff: true }, "approve"), decide({ name: "Aulia", code: "A", full: false, staff: true }, "revise")]);
  assert.deepEqual(r.filter((x) => x === "ok").length, 1);
  assert.equal((saved as Qa).round, 1);
  assert.equal((saved as Qa).st, "approved");
});
