import { test } from "node:test";
import assert from "node:assert/strict";
import { expired, inMorningWindow, itemsMessage, itemsReady, morningKey, morningPushes, wibKey, type MMember, type MTask } from "./logic";

// Jumat 30 Okt 2026 07.00 WIB = 00.00 UTC
const FRI_7 = new Date("2026-10-30T00:00:00Z");
const members: MMember[] = [
  { userId: "uz", code: "Z", name: "Zaki Ramadhan", offDays: [4] },
  { userId: "ur", code: "R", name: "Rayhan Putra", offDays: [2, 4] },
  { userId: "ua", code: "A", name: "Aulia", offDays: [4, 5] }, // libur Jumat
  { userId: "us", code: "S", name: "Salma", offDays: [4, 5] }, // libur Jumat
  { userId: "ux", code: "~1", name: "Aldo", offDays: [] }, // admin tanpa kode
];
const task = (p: Partial<MTask>): MTask => ({
  type: "igf",
  title: "Barang",
  status: "Terdata",
  shootPlan: "2026-10-30",
  producer: null,
  talent: null,
  script: null,
  createdAt: new Date("2026-10-26T03:00:00Z"),
  ...p,
});

test("tanggal & jendela WIB", () => {
  assert.equal(wibKey(new Date("2026-10-29T17:30:00Z")), "2026-10-30"); // 00.30 WIB sudah hari berikutnya
  assert.equal(inMorningWindow(new Date("2026-10-29T23:59:00Z")), false); // 06.59
  assert.equal(inMorningWindow(FRI_7), true); // 07.00
  assert.equal(inMorningWindow(new Date("2026-10-30T02:59:00Z")), true); // 09.59 (susulan)
  assert.equal(inMorningWindow(new Date("2026-10-30T03:00:00Z")), false); // 10.00
});

test("isi notifikasi pagi: hari ini + talent + terlambat", () => {
  const tasks = [
    task({ type: "igf", title: "Asics Gel Resolution 9", producer: "R", talent: "S" }),
    task({ type: "vpr", title: "Yonex Ezone 100", producer: "R" }),
    task({ type: "vrv", title: "Lama", producer: "R", shootPlan: "2026-10-27" }),
    task({ type: "ktl", title: "Besok", producer: "R", shootPlan: "2026-10-31" }),
    task({ type: "ktl", title: "Sudah jalan", producer: "R", status: "Diproduksi" }),
  ];
  const p = morningPushes(tasks, members, FRI_7);
  assert.equal(p.length, 1);
  assert.equal(p[0].userId, "ur");
  assert.equal(p[0].title, "Syuting hari ini · 3 konten");
  assert.equal(p[0].body, "Foto Instagram – Asics Gel Resolution 9 (talent Salma) · Video produk – Yonex Ezone 100 · 1 terlambat");
  assert.equal(p[0].url, "/studio/?p=pipeline");
});

test("talent/script ikut menerima; libur pribadi & tanpa tugas tidak dikirim", () => {
  const tasks = [task({ producer: "R", talent: "S", script: "Z" })];
  const ids = morningPushes(tasks, members, FRI_7).map((p) => p.userId).sort();
  assert.deepEqual(ids, ["ur", "uz"]); // Salma libur Jumat; Aulia & Aldo tidak punya tugas
});

test("Kamis seluruh tim libur", () => {
  const thu = new Date("2026-10-29T00:00:00Z");
  assert.deepEqual(morningPushes([task({ producer: "Z", shootPlan: "2026-10-29" })], members, thu), []);
});

test("hanya terlambat tetap dikirim; konten hangus tidak", () => {
  const p = morningPushes([task({ producer: "Z", shootPlan: "2026-10-28" })], members, FRI_7);
  assert.equal(p[0].title, "Syuting hari ini · 1 konten");
  assert.equal(p[0].body, "1 terlambat");
  assert.equal(expired(new Date("2026-09-30T03:00:00Z"), "2026-10-30"), true);
  assert.deepEqual(morningPushes([task({ producer: "Z", shootPlan: "2026-10-01", createdAt: new Date("2026-09-29T03:00:00Z") })], members, FRI_7), []);
});

test("kunci kirim-sekali per orang per hari", () => {
  assert.equal(morningKey("2026-10-30", "uz"), "pagi:2026-10-30:uz");
  assert.notEqual(morningKey("2026-10-30", "uz"), morningKey("2026-10-31", "uz"));
});

test("barang masuk digabung per 2 menit", () => {
  const t0 = new Date("2026-10-30T03:00:00Z");
  const q = [{ createdAt: t0 }, { createdAt: new Date(t0.getTime() + 90_000) }];
  assert.equal(itemsReady([], t0), false);
  assert.equal(itemsReady(q, new Date(t0.getTime() + 119_000)), false);
  assert.equal(itemsReady(q, new Date(t0.getTime() + 120_000)), true);
  assert.deepEqual(itemsMessage(["Asics Gel Resolution 9 putih"]), { title: "Barang masuk", body: "Asics Gel Resolution 9 putih" });
  const m = itemsMessage(["A", "B", "C", "D", "E", "F"]);
  assert.equal(m.title, "6 barang masuk");
  assert.equal(m.body, "A, B, C, D, E, …");
});
