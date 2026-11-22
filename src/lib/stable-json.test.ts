import { test } from "node:test";
import assert from "node:assert/strict";
import { stableJson } from "./stable-json";

test("urutan kunci dari database (JSONB) tidak membuat draf dianggap berubah", () => {
  const layar = { nodes: [{ id: "a", type: "trigger", data: { event: "x" }, position: { x: 1, y: 2 } }], edges: [{ id: "e", source: "a", target: "b", sourceHandle: null }] };
  const db = { edges: [{ id: "e", source: "a", target: "b", sourceHandle: null }], nodes: [{ id: "a", data: { event: "x" }, type: "trigger", position: { x: 1, y: 2 } }] };
  assert.notEqual(JSON.stringify(layar), JSON.stringify(db));
  assert.equal(stableJson(layar), stableJson(db));
  assert.notEqual(stableJson(layar), stableJson({ ...db, nodes: [{ ...db.nodes[0], position: { x: 9, y: 2 } }] }));
  assert.notEqual(stableJson({ a: [1, 2] }), stableJson({ a: [2, 1] })); // urutan isi daftar tetap berarti
});
