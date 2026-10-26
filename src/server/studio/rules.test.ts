import { test } from "node:test";
import assert from "node:assert/strict";
import { canRead, canWrite, type StudioUser } from "./rules";

const base = { userId: "u", name: "x", idcc: false };
const zaki: StudioUser = { ...base, email: "zaki@tirtonichub.com", code: "Z", full: true, staff: true, idcc: true };
const aulia: StudioUser = { ...base, email: "aulia@tirtonichub.com", code: "A", full: false, staff: true, idcc: true };
const rayhan: StudioUser = { ...base, email: "rayhan@tirtonichub.com", code: "R", full: false, staff: false };

test("kalender & catatan pribadi hanya pemiliknya", () => {
  assert.equal(canRead(rayhan, "pcal/rayhan@tirtonichub.com"), true);
  assert.equal(canRead(zaki, "pcal/rayhan@tirtonichub.com"), false);
  assert.notEqual(canWrite(zaki, "set", "pcal/rayhan@tirtonichub.com", null, { color: "lime" }), null);
  assert.equal(canWrite(rayhan, "set", "pcal/rayhan@tirtonichub.com", null, { color: "teal", notes: "x", updatedAt: 1 }), null);
});

test("laporan khusus admin penuh", () => {
  assert.equal(canRead(aulia, "reports/w1"), false);
  assert.equal(canRead(zaki, "reports/w1"), true);
});

test("kode Louis2: Admin 2 hanya mencatat JP dan tidak bisa mengubah kode", () => {
  assert.equal(canWrite(aulia, "set", "items/a", null, { name: "x", tier: "JP" }), null);
  assert.notEqual(canWrite(aulia, "set", "items/a", null, { name: "x", tier: "EX" }), null);
  assert.notEqual(canWrite(aulia, "update", "items/a", { tier: "JP" }, { tier: "EX" }), null);
  assert.equal(canWrite(aulia, "update", "items/a", { tier: "JP", qty: 1 }, { tier: "JP", qty: 3 }), null);
  assert.equal(canWrite(zaki, "update", "items/a", { tier: "JP" }, { tier: "EX" }), null);
});

test("anggota hanya memindahkan kartunya sendiri sampai Ready", () => {
  const card = { producer: "R", editor: "Z", status: "Terdata", title: "x" };
  assert.equal(canWrite(rayhan, "update", "tasks/t", card, { ...card, status: "Diproduksi", updatedAt: 2 }), null);
  assert.notEqual(canWrite(rayhan, "update", "tasks/t", card, { ...card, status: "Tayang" }), null);
  assert.notEqual(canWrite(rayhan, "update", "tasks/t", card, { ...card, title: "ganti" }), null);
  assert.notEqual(canWrite(rayhan, "update", "tasks/t", { ...card, producer: "A" }, { ...card, producer: "A", status: "Editing" }), null);
  assert.notEqual(canWrite(rayhan, "delete", "tasks/t", card, null), null);
});

test("profil sendiri: hanya avatar", () => {
  const me = { name: "Rayhan", role: "member", avColor: "lime" };
  assert.equal(canWrite(rayhan, "update", "members/rayhan@tirtonichub.com", me, { ...me, avColor: "pink", avAnimal: "cat" }), null);
  assert.notEqual(canWrite(rayhan, "update", "members/rayhan@tirtonichub.com", me, { ...me, role: "admin" }), null);
});
