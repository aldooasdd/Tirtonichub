import { test } from "node:test";
import assert from "node:assert/strict";
import { editNotifKind, editNotifMsg, tglID } from "./edit-logic";

const card = { type: "vpr", editor: "R", title: "Nike Vapor", status: "Terdata", readyBy: "" };

test("Terdata → Diproduksi: kirim ke editor", () => {
  assert.equal(editNotifKind(card, { ...card, status: "Diproduksi" }, "Z"), "start");
});
test("selama Terdata, mengisi deadline tidak mengirim", () => {
  assert.equal(editNotifKind(card, { ...card, readyBy: "2026-11-17" }, "Z"), null);
});
test("deadline diisi saat Diproduksi: kirim susulan", () => {
  const b = { ...card, status: "Diproduksi" };
  assert.equal(editNotifKind(b, { ...b, readyBy: "2026-11-17" }, "Z"), "deadline");
  assert.equal(editNotifKind({ ...b, readyBy: "2026-11-17" }, { ...b, readyBy: "2026-11-17", note: "x" }, "Z"), null);
});
test("hanya Foto IG, Video produk, Video review; bukan oleh editor sendiri", () => {
  assert.equal(editNotifKind({ ...card, type: "ktl" }, { ...card, type: "ktl", status: "Diproduksi" }, "Z"), null);
  assert.equal(editNotifKind(card, { ...card, status: "Diproduksi" }, "R"), null);
  assert.equal(editNotifKind(card, { ...card, status: "Diproduksi", editor: "" }, "Z"), null);
});
test("editor diganti saat Editing: kirim ke editor baru", () => {
  const b = { ...card, status: "Editing" };
  assert.equal(editNotifKind(b, { ...b, editor: "A" }, "Z"), "start");
});
test("isi pesan", () => {
  assert.equal(tglID("2026-11-17"), "Sel, 17 Nov 2026");
  const m = editNotifMsg("start", { ...card, status: "Diproduksi" }, "Zaki");
  assert.match(m.body, /Deadline Ready: belum ditetapkan/);
  assert.match(editNotifMsg("deadline", { ...card, readyBy: "2026-11-17" }, "Zaki").body, /Sel, 17 Nov 2026/);
});

test("jeda 15 menit: tiap edit menghitung ulang, 'start' tidak tertimpa 'deadline'", async () => {
  const { nextEditPending, EDIT_DELAY_MS, stillSendable } = await import("./edit-logic");
  const b = { ...card };
  const p1 = nextEditPending(undefined, b, { ...b, status: "Diproduksi" }, "Zaki", "Z", 1000)!;
  assert.deepEqual(p1, { kind: "start", due: 1000 + EDIT_DELAY_MS, by: "Zaki" });
  const d = { ...b, status: "Diproduksi" };
  const p2 = nextEditPending(p1, d, { ...d, readyBy: "2026-11-17" }, "Zaki", "Z", 5000)!;
  assert.equal(p2.kind, "start");
  assert.equal(p2.due, 5000 + EDIT_DELAY_MS);
  const p3 = nextEditPending(p2, d, { ...d, note: "x" }, "Zaki", "Z", 9000)!;
  assert.equal(p3.due, 9000 + EDIT_DELAY_MS);
  assert.equal(nextEditPending(undefined, d, { ...d, note: "x" }, "Zaki", "Z", 9000), undefined);
  assert.equal(stillSendable({ ...d }), true);
  assert.equal(stillSendable({ ...d, status: "Terdata" }), false);
  assert.match(editNotifMsg("start", d, "Zaki").body, /^\*Video produk\*/);
});
