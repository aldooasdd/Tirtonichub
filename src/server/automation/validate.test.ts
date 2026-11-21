import { test } from "node:test";
import assert from "node:assert/strict";
import { validateGraph, graphPolicies } from "./validate";
import { TEMPLATES_WF } from "./templates";

test("kelima workflow bawaan lolos validasi graf", () => {
  for (const w of TEMPLATES_WF) assert.deepEqual(validateGraph(w.graph), [], w.key);
});
test("graf ditolak: node tak dikenal, cabang hilang, siklus, nilai di luar daftar, tak terjangkau", () => {
  const g = structuredClone(TEMPLATES_WF[0].graph);
  assert.ok(validateGraph({ ...g, nodes: [...g.nodes, { id: "x", type: "script", data: {} }] }).some((i) => /tidak dikenal/.test(i.msg)));
  assert.ok(validateGraph({ ...g, edges: g.edges.filter((e) => e.sourceHandle !== "false") }).some((i) => /cabang "false"/.test(i.msg)));
  assert.ok(validateGraph({ ...g, edges: [...g.edges.filter((e) => e.source !== "n"), { id: "loop", source: "n", target: "c" }] }).some((i) => /siklus|End/.test(i.msg)));
  const bad = structuredClone(g); bad.nodes[1].data = { field: "type", op: "eq", value: "teks bebas" };
  assert.ok(validateGraph(bad).some((i) => /daftar/.test(i.msg)));
  const orphan = structuredClone(g); orphan.nodes.push({ id: "o", type: "end", data: {} });
  assert.ok(validateGraph(orphan).some((i) => /tidak terjangkau/.test(i.msg)));
  const two = structuredClone(g); two.nodes.push({ id: "t2", type: "trigger", data: { event: "content.published.v1" } });
  assert.ok(validateGraph(two).some((i) => /tepat satu Trigger/.test(i.msg)));
});
test("aturan bisnis yang dibutuhkan tiap workflow", () => {
  assert.deepEqual(graphPolicies(TEMPLATES_WF[0].graph).sort(), ["assignment.mapping", "notify.channel"]);
  assert.deepEqual(graphPolicies(TEMPLATES_WF[3].graph), ["campaign.master"]);
});
