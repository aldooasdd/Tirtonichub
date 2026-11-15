import { test } from "node:test";
import assert from "node:assert/strict";
import { expired, inMorningWindow, itemGroups, itemsMessage, itemsReady, morningKey, morningPushes, wibKey, type MMember, type MTask } from "./logic";

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
  assert.equal(p[0].title, "Syuting hari ini · 2 konten");
  assert.equal(p[0].body, "Video produk – Yonex Ezone 100 · Foto Instagram – Asics Gel Resolution 9 (talent Salma) · 1 terlambat produksi");
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
  assert.equal(p[0].title, "Konten terlambat · 1");
  assert.equal(p[0].body, "1 terlambat produksi");
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

test("barang dari + Konten tidak ikut WhatsApp", () => {
  const q = [{ itemId: "a", name: "Asics" }, { itemId: "k", name: "Konten" }, { itemId: "b", name: "Yonex" }];
  assert.deepEqual(itemGroups(q, new Set(["k"])), [{ wa: true, names: ["Asics", "Yonex"] }, { wa: false, names: ["Konten"] }]);
  assert.deepEqual(itemGroups(q.slice(1, 2), new Set(["k"])), [{ wa: false, names: ["Konten"] }]);
  assert.deepEqual(itemGroups(q.slice(0, 1), new Set()), [{ wa: true, names: ["Asics"] }]);
});

test("WA pagi: urutan jenis, deadline Ready hari ini, terlambat produksi & upload", () => {
  // Senin 16 Nov 2026 07.00 WIB
  const MON = new Date("2026-11-16T00:00:00Z");
  const d = "2026-11-16";
  const c = new Date("2026-11-10T03:00:00Z");
  const tasks = [
    task({ type: "ktl", title: "HEAD SPEED MP", producer: "R", shootPlan: d, createdAt: c }),
    task({ type: "igf", title: "ADIDAS UBERSONIC 5 Putih", producer: "R", talent: "S", shootPlan: d, createdAt: c }),
    task({ type: "vrv", title: "WILSON RF 01 hitam", producer: "R", shootPlan: d, createdAt: c }),
    task({ type: "vpr", title: "WILSON CLASH V3 pink", producer: "R", shootPlan: d, createdAt: c }),
    task({ type: "vrv", title: "ASICS GEL-RESOLUTION X", producer: "R", shootPlan: d, createdAt: c }),
    task({ type: "vrv", title: "LI-NING HALBERTEC", status: "Editing", producer: "A", editor: "R", shootPlan: "2026-11-12", readyBy: d, createdAt: c }),
    task({ type: "igf", title: "NIKE VAPOR PRO 2", producer: "R", shootPlan: "2026-11-14", createdAt: c }),
    task({ type: "vpr", title: "YONEX PERCEPT 97", status: "Editing", producer: "R", shootPlan: "2026-11-10", readyBy: "2026-11-12", createdAt: c }),
    task({ type: "vrv", title: "Lama tanpa readyBy", producer: "R", shootPlan: "2026-11-11", due: "2026-11-13", createdAt: c }),
    task({ type: "vrv", title: "Sudah Ready", status: "Ready", producer: "R", readyBy: "2026-11-12", createdAt: c }),
    task({ type: "vrv", title: "Hangus", producer: "R", shootPlan: "2026-10-01", createdAt: new Date("2026-10-01T03:00:00Z") }),
  ];
  const p = morningPushes(tasks, members, MON).find((x) => x.userId === "ur")!;
  assert.equal(p.title, "Syuting hari ini · 5 konten");
  assert.equal(
    p.wa,
    [
      "📋 *Senin, 16 November 2026*",
      "*Syuting hari ini · 5 konten*",
      "",
      "🎥 *Video review (2)*",
      "1. ASICS GEL-RESOLUTION X",
      "2. WILSON RF 01 hitam",
      "",
      "🎬 *Video produk (1)*",
      "1. WILSON CLASH V3 pink",
      "",
      "📷 *Foto Instagram (1)*",
      "1. ADIDAS UBERSONIC 5 Putih (talent Salma)",
      "",
      "🛍️ *Foto katalog (1)*",
      "1. HEAD SPEED MP",
      "",
      "⏰ *Deadline Ready hari ini · 1 konten*",
      "_Harus sudah Ready (file final terunggah) hari ini:_",
      "🎥 *Video review*",
      "1. LI-NING HALBERTEC (Editing)",
      "",
      "⚠️ *Terlambat produksi · 1 konten*",
      "_Rencana syuting sudah lewat, masih Terdata:_",
      "1. *Foto Instagram* – NIKE VAPOR PRO 2 (rencana 14 Nov)",
      "",
      "🚨 *Terlambat upload · 2 konten*",
      "_Deadline Ready sudah lewat, file final belum diunggah ke Studio:_",
      "1. *Video review* – Lama tanpa readyBy (deadline 13 Nov, Terdata)",
      "2. *Video produk* – YONEX PERCEPT 97 (deadline 12 Nov, Editing)",
      "",
      "Buka Tirtonic Studio: https://tirtonichub.com/studio/?p=pipeline",
    ].join("\n"),
  );
  // Aulia libur? Senin tidak; Aulia produser kartu LI-NING → ikut deadline hari ini tanpa syuting
  const a = morningPushes(tasks, members, MON).find((x) => x.userId === "ua")!;
  assert.equal(a.title, "Deadline Ready hari ini · 1 konten");
  assert.match(a.wa!, /_Tidak ada syuting hari ini._/);
});
